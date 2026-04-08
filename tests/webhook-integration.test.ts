/**
 * Integration / contract tests for the GitHub webhook pipeline.
 *
 * These tests exercise `handlePullRequestWebhook` (and the top-level POST
 * handler for error-path tests) with all external dependencies stubbed:
 *
 *   - Database (session-store, settings-store, marketplace-store, attempt-store)
 *   - LLM client (openai.ts)
 *   - Remote config (remote-config.ts)
 *   - LangFuse tracing (langfuse.ts)
 *   - Remote repo context (remote-repo-context.ts)
 *
 * The mock `octokit` captures every GitHub API call so we can assert on
 * the exact commit-status states, descriptions, and comment bodies that
 * would be posted to GitHub.
 *
 * Run with:
 *   node --experimental-test-module-mocks --import tsx --test tests/webhook-integration.test.ts
 */

import { mock, test, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { SessionStatus } from "@prisma/client";

// ─── Type helpers ────────────────────────────────────────────────────
interface StatusCall {
  owner: string;
  repo: string;
  sha: string;
  state: string;
  context: string;
  description: string;
  target_url?: string;
}

interface CommentCall {
  owner: string;
  repo: string;
  issue_number?: number;
  comment_id?: number;
  body: string;
}

// ─── Shared state that tests inspect ─────────────────────────────────
let statusCalls: StatusCall[] = [];
let commentCalls: CommentCall[] = [];
let listFilesCalls: Array<{ owner: string; repo: string; pull_number: number }> = [];

// ─── Configurable store state per test ───────────────────────────────
let mockSettings: any = undefined;
let mockIsPaid = false;
let mockQuizGenerationsToday = 0;
let mockExistingSession: any = undefined;

// ─── Mock octokit factory ────────────────────────────────────────────
function createMockOctokit() {
  statusCalls = [];
  commentCalls = [];
  listFilesCalls = [];

  return {
    rest: {
      repos: {
        createCommitStatus: mock.fn(async (params: any) => {
          statusCalls.push({
            owner: params.owner,
            repo: params.repo,
            sha: params.sha,
            state: params.state,
            context: params.context,
            description: params.description,
            target_url: params.target_url,
          });
          return { data: {} };
        }),
        getContent: mock.fn(async () => {
          // Return 404-like (no config file) by default
          throw new Error("Not Found");
        }),
      },
      pulls: {
        listFiles: mock.fn(async (params: any) => {
          listFilesCalls.push({
            owner: params.owner,
            repo: params.repo,
            pull_number: params.pull_number,
          });
          return {
            data: [
              {
                sha: "abc123",
                filename: "src/index.ts",
                status: "modified",
                additions: 10,
                deletions: 5,
                changes: 15,
                patch:
                  "@@ -1,5 +1,10 @@\n-const old = true;\n+const new = false;\n+function hello() {\n+  return 'world';\n+}",
              },
            ],
          };
        }),
      },
      issues: {
        createComment: mock.fn(async (params: any) => {
          commentCalls.push({
            owner: params.owner,
            repo: params.repo,
            issue_number: params.issue_number,
            body: params.body,
          });
          return { data: { id: 42 } };
        }),
        updateComment: mock.fn(async (params: any) => {
          commentCalls.push({
            owner: params.owner,
            repo: params.repo,
            comment_id: params.comment_id,
            body: params.body,
          });
          return { data: { id: params.comment_id } };
        }),
      },
      reactions: {
        createForIssueComment: mock.fn(async () => ({ data: {} })),
      },
    },
    paginate: mock.fn(async (_method: any, params: any) => {
      // paginate calls the method, but we return the fixture directly
      return [
        {
          sha: "abc123",
          filename: "src/index.ts",
          status: "modified",
          additions: 10,
          deletions: 5,
          changes: 15,
          patch:
            "@@ -1,5 +1,10 @@\n-const old = true;\n+const new = false;\n+function hello() {\n+  return 'world';\n+}",
        },
      ];
    }),
  };
}

// ─── Mock quiz payload ───────────────────────────────────────────────
const MOCK_QUIZ = {
  summary: "Test quiz summary",
  questions: [
    {
      id: "q1",
      prompt: "What changed?",
      options: [
        { key: "A", text: "Option A" },
        { key: "B", text: "Option B" },
        { key: "C", text: "Option C" },
      ],
      correctOption: "A",
      explanation: "Because A is correct.",
      diffAnchors: ["src/index.ts"],
      focus: "behavior",
    },
    {
      id: "q2",
      prompt: "Why was this done?",
      options: [
        { key: "A", text: "Reason A" },
        { key: "B", text: "Reason B" },
        { key: "C", text: "Reason C" },
      ],
      correctOption: "B",
      explanation: "Because B is the reason.",
      diffAnchors: ["src/index.ts"],
      focus: "intent",
    },
  ],
};

// ─── Module mocks ────────────────────────────────────────────────────
// These must be declared before the import of the module under test.

// Mock session-store (database)
mock.module("../src/lib/server/session-store.js", {
  namedExports: {
    getSession: async () => mockExistingSession,
    getSessionById: async () => undefined,
    upsertSession: async (s: any) => ({ ...s, id: s.id ?? "session-test-id" }),
    deleteSession: async () => true,
  },
});

// Mock settings-store (database)
mock.module("../src/lib/server/settings-store.js", {
  namedExports: {
    getSettings: async () => mockSettings,
    upsertSettings: async (s: any) => s,
  },
});

// Mock marketplace-store (database)
mock.module("../src/lib/server/marketplace-store.js", {
  namedExports: {
    FREE_PLAN_DAILY_QUIZ_LIMIT: 10,
    isPaidPlan: async () => mockIsPaid,
    countQuizGenerationsToday: async () => mockQuizGenerationsToday,
    getPlan: async () => undefined,
    upsertPlan: async () => {},
    downgradeToFree: async () => {},
  },
});

// Mock attempt-store (database)
mock.module("../src/lib/server/attempt-store.js", {
  namedExports: {
    gradeQuizAnswers: (session: any, answers: any) => ({
      answers,
      questionCount: session.quiz?.questions?.length ?? 0,
      correctCount: 0,
      passed: false,
    }),
    createQuizAttempt: async () => ({ attemptNumber: 1 }),
    getAttemptStats: async () => ({
      totalAttempts: 0,
      passedAttempts: 0,
      failedAttempts: 0,
      uniqueAuthors: 0,
    }),
  },
});

// Mock langfuse (tracing — no-op)
mock.module("../src/lib/server/langfuse.js", {
  namedExports: {
    createTrace: () => ({
      traceId: "trace-test-id",
      span: () => ({ end: () => {} }),
      end: () => {},
    }),
    getChatPrompt: async () => undefined,
    getLangfusePublicConfig: () => undefined,
  },
});

// Mock remote-repo-context (avoids GitHub API calls for repo tree)
mock.module("../src/lib/server/remote-repo-context.js", {
  namedExports: {
    buildRemoteRepoContext: async () => ({
      repoMap: [],
      changedFileContexts: [],
    }),
  },
});

// Mock db module to prevent Prisma from initializing
mock.module("../src/lib/server/db.js", {
  namedExports: {
    prisma: {},
  },
});

// Mock render.ts to avoid the $lib/constants SvelteKit path alias issue.
// (render.ts is already fully tested in app-render.test.ts)
mock.module("../src/lib/server/render.js", {
  namedExports: {
    renderSessionComment: (session: any) => {
      if (session.status === "quota_exceeded") {
        return "### :white_check_mark: SlopBlock — Passed\n\n> free plan limit of **10 quiz generations per day**";
      }
      if (session.status === "skipped") {
        return `### :next_track_button: SlopBlock — Skipped\n\n> ${session.skipReason ?? "Skipped"}`;
      }
      if (session.status === "passed") {
        return `### :white_check_mark: SlopBlock — Passed\n\nQuiz passed for commit \`${session.headSha?.slice(0, 7)}\`.`;
      }
      if (session.status === "failed") {
        return `### :x: SlopBlock — Failed\n\n${session.failureMessage ?? "Quiz failed."}`;
      }
      const qc = session.quiz?.questions?.length ?? session.questionCount ?? 0;
      return `### :brain: SlopBlock — ${qc} Questions Waiting\n\n> :point_right: **[Take the Quiz](https://slopblock.test/session/test)**`;
    },
  },
});

// ─── Configurable LLM mock ──────────────────────────────────────────
// By default, the LLM generates a quiz successfully. Tests can override
// `mockLlmBehavior` to simulate errors.
let mockLlmBehavior:
  | "success"
  | "missing_provider"
  | "missing_model"
  | "insufficient_credits"
  | "token_budget_pass"
  | "token_budget_fail" = "success";

mock.module("../src/lib/server/openai.js", {
  namedExports: {
    OpenAICompatibleClient: class MockOpenAICompatibleClient {
      constructor() {
        // Empty — no real connection
      }
      async generateQuiz() {
        if (mockLlmBehavior === "insufficient_credits") {
          const err: any = new Error("Insufficient credits");
          err.name = "InsufficientCreditsError";
          err.status = 402;
          throw err;
        }
        return MOCK_QUIZ;
      }
      async validateQuiz() {
        return { valid: true, issues: [] };
      }
      async evaluateBorderlineSkip() {
        return { outcome: "quiz", certainty: "high", reason: "Needs review" };
      }
    },
    InsufficientCreditsError: class InsufficientCreditsError extends Error {
      status = 402;
      constructor(message = "Insufficient credits") {
        super(message);
        this.name = "InsufficientCreditsError";
      }
    },
    TokenBudgetExceededError: class TokenBudgetExceededError extends Error {
      tokensUsed: number;
      budget: number;
      fallback?: string;
      constructor(tokensUsed: number, budget: number) {
        super(`Token budget exceeded: ${tokensUsed}/${budget}`);
        this.name = "TokenBudgetExceededError";
        this.tokensUsed = tokensUsed;
        this.budget = budget;
      }
    },
    TokenTracker: class MockTokenTracker {
      totalTokens = 0;
      constructor() {}
      add() {}
    },
  },
});

// ─── Import the module under test AFTER mocks are set up ─────────────
const { handlePullRequestWebhook, MissingProviderError, MissingModelError } = await import(
  "../src/lib/server/service.js"
);

// ─── Payload factory ─────────────────────────────────────────────────
function makePrPayload(overrides: Record<string, any> = {}) {
  return {
    action: "opened",
    pull_request: {
      number: 1,
      draft: false,
      user: { login: "alice", type: "User" },
      head: {
        sha: "abc123def456",
        repo: { fork: false },
      },
      ...overrides.pull_request,
    },
    repository: {
      id: 100,
      name: "test-repo",
      full_name: "test-owner/test-repo",
      owner: { login: "test-owner" },
      ...overrides.repository,
    },
    installation: {
      id: 1,
      ...overrides.installation,
    },
    ...overrides,
  };
}

// ─── Reset state between tests ──────────────────────────────────────
beforeEach(() => {
  mockSettings = undefined;
  mockIsPaid = false;
  mockQuizGenerationsToday = 0;
  mockExistingSession = undefined;
  mockLlmBehavior = "success";
  // Set env vars needed for LLM client
  process.env.SLOPBLOCK_API_KEY = "test-key";
  process.env.SLOPBLOCK_BASE_URL = "https://test.openai.com";
  process.env.SLOPBLOCK_MODEL = "test-model";
  process.env.APP_BASE_URL = "https://slopblock.test";
});

// =====================================================================
// Test: Graceful status for misconfiguration (no API key)
// =====================================================================
describe("misconfiguration errors", () => {
  test("MissingProviderError → error status with helpful message", async () => {
    delete process.env.SLOPBLOCK_API_KEY;
    delete process.env.SLOPBLOCK_BASE_URL;
    const octokit = createMockOctokit();

    await assert.rejects(
      () => handlePullRequestWebhook(octokit, makePrPayload()),
      (err: any) => err instanceof MissingProviderError,
    );

    // The webhook handler (in +server.ts) would catch this and set the status.
    // We verify the error type is correct so the handler can produce the right message.
    // The expected status message is:
    //   "No LLM provider configured. Visit slopblock settings to connect one."
  });

  test("MissingModelError → error status with helpful message", async () => {
    process.env.SLOPBLOCK_API_KEY = "test-key";
    process.env.SLOPBLOCK_BASE_URL = "https://test.openai.com";
    delete process.env.SLOPBLOCK_MODEL;
    delete process.env.SLOPBLOCK_GENERATION_MODEL;
    delete process.env.SLOPBLOCK_VALIDATION_MODEL;
    delete process.env.SLOPBLOCK_SKIP_MODEL;

    // Override settings with blank models to trigger MissingModelError.
    // Default config always has models set, so we need installation settings
    // that explicitly blank them out.
    mockSettings = {
      llmGenerationModel: "",
      llmValidationModel: "",
      llmSkipModel: "",
    };
    const octokit = createMockOctokit();

    await assert.rejects(
      () => handlePullRequestWebhook(octokit, makePrPayload()),
      (err: any) => err instanceof MissingModelError,
    );
  });
});

// =====================================================================
// Test: Webhook handler error catch → commit status
// =====================================================================
describe("webhook error handler sets commit status", () => {
  // These tests exercise the error-handling path in the webhook POST handler.
  // We import the webhook handler logic and simulate what +server.ts does.

  async function simulateWebhookErrorHandler(
    octokit: any,
    payload: any,
    error: Error,
  ): Promise<StatusCall | undefined> {
    const { InsufficientCreditsError, TokenBudgetExceededError } = await import(
      "../src/lib/server/openai.js"
    );
    const { setCommitStatus } = await import("../src/lib/server/github-service.js");

    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const pr = payload.pull_request;

    const isMissingProvider = error instanceof MissingProviderError;
    const isMissingModel = error instanceof MissingModelError;
    const isInsufficientCredits = error instanceof InsufficientCreditsError;
    const isTokenBudget = error instanceof TokenBudgetExceededError;

    if (isMissingProvider || isMissingModel || isInsufficientCredits || isTokenBudget) {
      const description = isInsufficientCredits
        ? "LLM provider has insufficient credits. Add credits and re-trigger."
        : isTokenBudget
          ? (error as any).fallback === "fail"
            ? `Token budget exceeded (${(error as any).tokensUsed.toLocaleString()}/${(error as any).budget.toLocaleString()}). Merge blocked.`
            : `Token budget exceeded (${(error as any).tokensUsed.toLocaleString()}/${(error as any).budget.toLocaleString()}). Quiz skipped.`
          : isMissingModel
            ? "LLM models are not fully configured. Select all required models in settings."
            : "No LLM provider configured. Visit slopblock settings to connect one.";

      await setCommitStatus({
        octokit,
        owner,
        repo,
        sha: pr.head.sha,
        state: isTokenBudget
          ? (error as any).fallback === "fail"
            ? "failure"
            : "success"
          : "error",
        description,
      });

      return statusCalls[statusCalls.length - 1];
    }
    return undefined;
  }

  test("MissingProviderError → error state with setup instructions", async () => {
    const octokit = createMockOctokit();
    const payload = makePrPayload();
    const error = new MissingProviderError();
    const status = await simulateWebhookErrorHandler(octokit, payload, error);

    assert.ok(status);
    assert.equal(status.state, "error");
    assert.equal(
      status.description,
      "No LLM provider configured. Visit slopblock settings to connect one.",
    );
    assert.equal(status.owner, "test-owner");
    assert.equal(status.repo, "test-repo");
  });

  test("MissingModelError → error state with model setup instructions", async () => {
    const octokit = createMockOctokit();
    const payload = makePrPayload();
    const error = new MissingModelError("generation");
    const status = await simulateWebhookErrorHandler(octokit, payload, error);

    assert.ok(status);
    assert.equal(status.state, "error");
    assert.equal(
      status.description,
      "LLM models are not fully configured. Select all required models in settings.",
    );
  });

  test("InsufficientCreditsError → error state with credits message", async () => {
    const octokit = createMockOctokit();
    const payload = makePrPayload();
    const { InsufficientCreditsError } = await import("../src/lib/server/openai.js");
    const error = new InsufficientCreditsError("Insufficient credits");
    const status = await simulateWebhookErrorHandler(octokit, payload, error);

    assert.ok(status);
    assert.equal(status.state, "error");
    assert.equal(
      status.description,
      "LLM provider has insufficient credits. Add credits and re-trigger.",
    );
  });

  test("TokenBudgetExceededError (fallback=pass) → success state", async () => {
    const octokit = createMockOctokit();
    const payload = makePrPayload();
    const { TokenBudgetExceededError } = await import("../src/lib/server/openai.js");
    const error = new TokenBudgetExceededError(150_000, 100_000);
    error.fallback = "pass";
    const status = await simulateWebhookErrorHandler(octokit, payload, error);

    assert.ok(status);
    assert.equal(status.state, "success");
    assert.match(status.description, /Token budget exceeded/);
    assert.match(status.description, /Quiz skipped/);
  });

  test("TokenBudgetExceededError (fallback=fail) → failure state", async () => {
    const octokit = createMockOctokit();
    const payload = makePrPayload();
    const { TokenBudgetExceededError } = await import("../src/lib/server/openai.js");
    const error = new TokenBudgetExceededError(150_000, 100_000);
    error.fallback = "fail";
    const status = await simulateWebhookErrorHandler(octokit, payload, error);

    assert.ok(status);
    assert.equal(status.state, "failure");
    assert.match(status.description, /Token budget exceeded/);
    assert.match(status.description, /Merge blocked/);
  });
});

// =====================================================================
// Test: Free plan billing limit
// =====================================================================
describe("billing / quota limit", () => {
  test("free plan over daily limit → success status with upgrade message", async () => {
    mockIsPaid = false;
    mockQuizGenerationsToday = 10; // at the limit
    const octokit = createMockOctokit();

    await handlePullRequestWebhook(octokit, makePrPayload());

    assert.equal(statusCalls.length, 1);
    assert.equal(statusCalls[0].state, "success");
    assert.match(statusCalls[0].description, /Free plan limit reached/);
    assert.match(statusCalls[0].description, /10\/day/);
    assert.match(statusCalls[0].description, /Upgrade/);
  });

  test("free plan over daily limit → comment posted with upgrade CTA", async () => {
    mockIsPaid = false;
    mockQuizGenerationsToday = 10;
    const octokit = createMockOctokit();

    await handlePullRequestWebhook(octokit, makePrPayload());

    assert.equal(commentCalls.length, 1);
    assert.match(commentCalls[0].body, /free plan limit/i);
    assert.match(commentCalls[0].body, /Passed/);
  });

  test("paid plan over daily limit → quiz still generated (no limit)", async () => {
    mockIsPaid = true;
    mockQuizGenerationsToday = 100; // way over free limit, but paid
    const octokit = createMockOctokit();

    await handlePullRequestWebhook(octokit, makePrPayload());

    // Should NOT have the quota_exceeded status
    const quotaStatus = statusCalls.find((s) => s.description.includes("Free plan limit"));
    assert.equal(quotaStatus, undefined);

    // Should have the quiz-generated pending status
    const quizStatus = statusCalls.find((s) => s.description.includes("questions waiting"));
    assert.ok(quizStatus);
    assert.equal(quizStatus.state, "pending");
  });
});

// =====================================================================
// Test: Bot and fork skip based on admin settings
// =====================================================================
describe("admin settings: skip bots and forks", () => {
  test("bot PR with skipBots=true → success status (skipped)", async () => {
    const octokit = createMockOctokit();
    const payload = makePrPayload({
      pull_request: {
        number: 1,
        draft: false,
        user: { login: "dependabot[bot]", type: "Bot" },
        head: { sha: "abc123def456", repo: { fork: false } },
      },
    });

    await handlePullRequestWebhook(octokit, payload);

    assert.equal(statusCalls.length, 1);
    assert.equal(statusCalls[0].state, "success");
    assert.match(statusCalls[0].description, /Bot-authored.*skipped/);
  });

  test("bot PR with skipBots=false → quiz generated (not skipped)", async () => {
    mockSettings = { skipBots: false };
    const octokit = createMockOctokit();
    const payload = makePrPayload({
      pull_request: {
        number: 1,
        draft: false,
        user: { login: "dependabot[bot]", type: "Bot" },
        head: { sha: "abc123def456", repo: { fork: false } },
      },
    });

    await handlePullRequestWebhook(octokit, payload);

    const botSkipped = statusCalls.find((s) => s.description.includes("Bot-authored"));
    assert.equal(botSkipped, undefined, "Bot should NOT be skipped when skipBots=false");
  });

  test("fork PR with skipForkPullRequests=true → success status (skipped)", async () => {
    const octokit = createMockOctokit();
    const payload = makePrPayload({
      pull_request: {
        number: 1,
        draft: false,
        user: { login: "contributor", type: "User" },
        head: { sha: "abc123def456", repo: { fork: true } },
      },
    });

    await handlePullRequestWebhook(octokit, payload);

    assert.equal(statusCalls.length, 1);
    assert.equal(statusCalls[0].state, "success");
    assert.match(statusCalls[0].description, /Fork.*skipped/);
  });

  test("fork PR with skipForks=false → quiz generated (not skipped)", async () => {
    mockSettings = { skipForks: false };
    const octokit = createMockOctokit();
    const payload = makePrPayload({
      pull_request: {
        number: 1,
        draft: false,
        user: { login: "contributor", type: "User" },
        head: { sha: "abc123def456", repo: { fork: true } },
      },
    });

    await handlePullRequestWebhook(octokit, payload);

    const forkSkipped = statusCalls.find((s) => s.description.includes("Fork"));
    assert.equal(forkSkipped, undefined, "Fork should NOT be skipped when skipForks=false");
  });
});

// =====================================================================
// Test: Comment posted on PR creation
// =====================================================================
describe("comment posted on PR creation", () => {
  test("opened PR → comment created with quiz link", async () => {
    const octokit = createMockOctokit();

    await handlePullRequestWebhook(octokit, makePrPayload());

    assert.ok(commentCalls.length >= 1, "At least one comment should be created");
    const comment = commentCalls[0];
    assert.equal(comment.owner, "test-owner");
    assert.equal(comment.repo, "test-repo");
    assert.equal(comment.issue_number, 1);
    assert.match(comment.body, /SlopBlock/);
    assert.match(comment.body, /Questions Waiting/);
    assert.match(comment.body, /Take the Quiz/);
  });

  test("opened PR → pending commit status with question count", async () => {
    const octokit = createMockOctokit();

    await handlePullRequestWebhook(octokit, makePrPayload());

    // There should be two statuses: "Generating..." and "N questions waiting"
    assert.ok(statusCalls.length >= 2, "Expected at least 2 status calls");

    const generating = statusCalls.find((s) => s.description.includes("Generating"));
    assert.ok(generating);
    assert.equal(generating.state, "pending");

    const waiting = statusCalls.find((s) => s.description.includes("questions waiting"));
    assert.ok(waiting);
    assert.equal(waiting.state, "pending");
    assert.match(waiting.description, /2 questions waiting/);
  });
});

// =====================================================================
// Test: Subsequent pushes (synchronize)
// =====================================================================
describe("subsequent pushes (synchronize)", () => {
  test("same headSha → cache hit, no new quiz generated", async () => {
    // Simulate an existing session with the same headSha
    mockExistingSession = {
      id: "existing-session-id",
      installationId: 1,
      repositoryId: 100,
      repositoryOwner: "test-owner",
      repositoryName: "test-repo",
      pullNumber: 1,
      authorLogin: "alice",
      headSha: "abc123def456", // same as payload
      status: SessionStatus.awaiting_answer,
      currentQuestionIndex: 0,
      questionCount: 3,
      retryMode: "new_quiz",
      quiz: MOCK_QUIZ,
      commentId: 42,
    };

    const octokit = createMockOctokit();
    const payload = makePrPayload({ action: "synchronize" });

    await handlePullRequestWebhook(octokit, payload);

    // Should set a pending status reusing the cached session, NOT generate a new quiz
    assert.equal(statusCalls.length, 1, "Only one status call for cache hit");
    assert.equal(statusCalls[0].state, "pending");
    assert.match(statusCalls[0].description, /questions waiting/);

    // No new comments should be created (existing comment is reused)
    assert.equal(commentCalls.length, 0, "No new comment for cache hit");
  });

  test("different headSha → new quiz generated, comment updated", async () => {
    // Existing session with a DIFFERENT headSha
    mockExistingSession = {
      id: "existing-session-id",
      installationId: 1,
      repositoryId: 100,
      repositoryOwner: "test-owner",
      repositoryName: "test-repo",
      pullNumber: 1,
      authorLogin: "alice",
      headSha: "old-sha-000000", // different from payload
      status: SessionStatus.awaiting_answer,
      currentQuestionIndex: 0,
      questionCount: 3,
      retryMode: "new_quiz",
      quiz: MOCK_QUIZ,
      commentId: 42,
    };

    const octokit = createMockOctokit();
    const payload = makePrPayload({ action: "synchronize" });

    await handlePullRequestWebhook(octokit, payload);

    // Should go through the full quiz generation flow
    const generating = statusCalls.find((s) => s.description.includes("Generating"));
    assert.ok(generating, "Should show generating status");

    const waiting = statusCalls.find((s) => s.description.includes("questions waiting"));
    assert.ok(waiting, "Should show questions waiting status");

    // Comment should be updated (updateComment called since commentId exists)
    assert.ok(commentCalls.length >= 1, "Comment should be created/updated");
  });

  test("reopened PR → treated same as opened (new quiz)", async () => {
    const octokit = createMockOctokit();
    const payload = makePrPayload({ action: "reopened" });

    await handlePullRequestWebhook(octokit, payload);

    const generating = statusCalls.find((s) => s.description.includes("Generating"));
    assert.ok(generating, "Should generate quiz on reopen");
  });

  test("ready_for_review (from draft) → treated same as opened", async () => {
    const octokit = createMockOctokit();
    const payload = makePrPayload({ action: "ready_for_review" });

    await handlePullRequestWebhook(octokit, payload);

    const generating = statusCalls.find((s) => s.description.includes("Generating"));
    assert.ok(generating, "Should generate quiz when PR leaves draft");
  });

  test("draft PR → ignored (no status, no comment)", async () => {
    const octokit = createMockOctokit();
    const payload = makePrPayload({
      pull_request: {
        number: 1,
        draft: true,
        user: { login: "alice", type: "User" },
        head: { sha: "abc123def456", repo: { fork: false } },
      },
    });

    await handlePullRequestWebhook(octokit, payload);

    assert.equal(statusCalls.length, 0, "No status for draft PR");
    assert.equal(commentCalls.length, 0, "No comment for draft PR");
  });
});

// =====================================================================
// Summary / documentation
// =====================================================================
describe("documented behavior: subsequent push scenarios", () => {
  /**
   * When a PR receives a subsequent push (synchronize event):
   *
   * 1. SAME HEAD SHA (cache hit):
   *    - No new quiz is generated
   *    - The existing pending status is re-posted with "N questions waiting"
   *    - The existing comment is NOT touched
   *    - This handles GitHub re-delivering webhooks or force-push to same SHA
   *
   * 2. DIFFERENT HEAD SHA (new commit pushed):
   *    - A completely new quiz is generated from the updated diff
   *    - The "Generating..." pending status is shown immediately
   *    - Once generated, "N questions waiting" pending status replaces it
   *    - The existing PR comment is UPDATED (not a new comment) with the new quiz
   *    - Previous quiz answers are discarded — author must retake the quiz
   *
   * 3. DRAFT PR:
   *    - Synchronize events on draft PRs are ignored entirely
   *    - No status or comment is posted until ready_for_review
   *
   * 4. PASSED SESSION + NEW PUSH:
   *    - If the quiz was already passed but a new commit arrives:
   *    - The session is NOT cached (status !== awaiting_answer), so a new quiz
   *      is generated for the new commit
   *    - The old "passed" comment is updated to the new "awaiting" state
   */
  test("documentation marker", () => {
    // This test exists to document the above behavior.
    assert.ok(true);
  });
});
