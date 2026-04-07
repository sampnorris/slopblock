import { SessionStatus } from "@prisma/client";
import type { SessionRecord } from "./session-store.js";
import type { SettingsRecord } from "./settings-store.js";

function mockAvatar(letter: string, background: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="${background}"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="DM Sans, Arial, sans-serif" font-size="30" font-weight="700" fill="white">${letter}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function devMocksEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.SLOPBLOCK_DEV_MOCKS !== "0";
}

export function mockActor() {
  return { login: "alice-dev" };
}

// Mock installation IDs and their plan states:
//   101 - acme-inc (Org, paid)
//   202 - alice-dev (User, free)
//   303 - bob-corp (Org, free — blocked)
//   404 - carol (User, paid)
export function mockInstallations() {
  return [
    {
      id: 101,
      account: {
        login: "acme-inc",
        avatar_url: mockAvatar("A", "#d4507e"),
        type: "Organization",
      },
    },
    {
      id: 202,
      account: {
        login: "alice-dev",
        avatar_url: mockAvatar("D", "#7c3aed"),
        type: "User",
      },
    },
    {
      id: 303,
      account: {
        login: "bob-corp",
        avatar_url: mockAvatar("B", "#059669"),
        type: "Organization",
      },
    },
    {
      id: 404,
      account: {
        login: "carol",
        avatar_url: mockAvatar("C", "#b45309"),
        type: "User",
      },
    },
  ];
}

export function mockSettings(installationId: string): SettingsRecord {
  // 101 = acme-inc (Org, paid)
  // 202 = alice-dev (User, free)
  // 303 = bob-corp (Org, free — would be blocked on quiz generation)
  // 404 = carol (User, paid)
  const planMap: Record<string, { accountType: string; marketplacePlan: "free" | "paid" }> = {
    "101": { accountType: "Organization", marketplacePlan: "paid" },
    "202": { accountType: "User", marketplacePlan: "free" },
    "303": { accountType: "Organization", marketplacePlan: "free" },
    "404": { accountType: "User", marketplacePlan: "paid" },
  };
  const { accountType, marketplacePlan } = planMap[installationId] ?? {
    accountType: "User",
    marketplacePlan: "free",
  };

  return {
    installationId,
    accountLogin: mockActor().login,
    accountType,
    marketplacePlan,
    llmBaseUrl: "https://openrouter.ai/api/v1",
    llmApiKey: "dev-mock-key",
    llmGenerationModel: "anthropic/claude-sonnet-4.5",
    llmValidationModel: "anthropic/claude-opus-4.1",
    llmSkipModel: "anthropic/claude-sonnet-4.5",
    questionCountMin: 2,
    questionCountMax: 3,
    quizGenerationMaxAttempts: 3,
    allowBestEffortFallback: true,
    retryMode: "same_quiz",
    allowedWrongAnswers: 0,
    skipBots: true,
    skipForks: true,
    customSystemPrompt: "",
    customQuizInstructions: "",
  };
}

export function mockSession(token: string): SessionRecord {
  return {
    id: token,
    installationId: 101,
    repositoryId: 1,
    repositoryOwner: "acme-inc",
    repositoryName: "slopblock-demo",
    pullNumber: 42,
    authorLogin: mockActor().login,
    headSha: "abcdef1234567890",
    status: SessionStatus.awaiting_answer,
    currentQuestionIndex: 0,
    questionCount: 3,
    retryMode: "same_quiz",
    allowedWrongAnswers: 0,
    generationModel: "anthropic/claude-sonnet-4.5",
    validationModel: "anthropic/claude-opus-4.1",
    summary: "This mock PR updates quiz generation rules and improves the dev preview flow.",
    quiz: {
      summary: "This mock PR updates quiz generation rules and improves the dev preview flow.",
      questions: [
        {
          id: "q1",
          prompt: "What changed about answer options in the quiz?",
          options: [
            { key: "A", text: "Questions now use exactly `3` options." },
            { key: "B", text: "Questions now use exactly `5` options." },
            { key: "C", text: "Questions can have any number of options." },
          ],
          correctOption: "A",
          explanation: "The quiz was updated to require exactly 3 options per question.",
          diffAnchors: ["src/lib/server/openai.ts", "src/lib/server/quiz.ts"],
          focus: "behavior",
        },
        {
          id: "q2",
          prompt: "What is the default answer mode in the mock dev session?",
          options: [
            { key: "A", text: "Generate a brand new quiz after every wrong answer." },
            { key: "B", text: "Explain mistakes and retry the same quiz." },
            { key: "C", text: "Only a maintainer can trigger any retry." },
          ],
          correctOption: "B",
          explanation: "The default retry behavior is the same-quiz mode that shows explanations.",
          diffAnchors: [
            "src/lib/server/config.ts",
            "src/routes/settings/[installationId]/+page.svelte",
          ],
          focus: "implementation",
        },
        {
          id: "q3",
          prompt: "Why do these dev mocks exist?",
          options: [
            {
              key: "A",
              text: "To let local pages open without real GitHub auth, app installs, or database state.",
            },
            { key: "B", text: "To permanently replace production data with static fixtures." },
            { key: "C", text: "To disable all validation logic in development." },
          ],
          correctOption: "A",
          explanation:
            "The mocks are dev-only and keep local preview flows usable without live integrations.",
          diffAnchors: ["src/lib/server/dev-mocks.ts"],
          focus: "risk",
        },
      ],
    },
  };
}

export function mockActivityData() {
  const now = new Date();
  const ago = (hours: number) => new Date(now.getTime() - hours * 3600000);

  return {
    sessions: [
      {
        id: "sess_1",
        repositoryOwner: "acme-inc",
        repositoryName: "api-gateway",
        pullNumber: 142,
        authorLogin: "alice-dev",
        headSha: "a1b2c3d",
        status: SessionStatus.awaiting_answer,
        questionCount: 3,
        generationModel: "anthropic/claude-sonnet-4.5",
        summary:
          "Adds rate limiting middleware to the API gateway with Redis-backed sliding window.",
        createdAt: ago(1),
        updatedAt: ago(0.5),
      },
      {
        id: "sess_2",
        repositoryOwner: "acme-inc",
        repositoryName: "api-gateway",
        pullNumber: 140,
        authorLogin: "bob-eng",
        headSha: "d4e5f6a",
        status: SessionStatus.passed,
        questionCount: 4,
        generationModel: "anthropic/claude-sonnet-4.5",
        summary:
          "Refactors authentication flow to use OIDC provider instead of custom JWT validation.",
        createdAt: ago(6),
        updatedAt: ago(4),
      },
      {
        id: "sess_3",
        repositoryOwner: "acme-inc",
        repositoryName: "web-dashboard",
        pullNumber: 87,
        authorLogin: "carol",
        headSha: "f7a8b9c",
        status: SessionStatus.skipped,
        questionCount: 0,
        generationModel: undefined,
        summary: undefined,
        skipReason: "Docs-only pull request matched configured skip rules.",
        createdAt: ago(12),
        updatedAt: ago(12),
      },
      {
        id: "sess_4",
        repositoryOwner: "acme-inc",
        repositoryName: "api-gateway",
        pullNumber: 138,
        authorLogin: "alice-dev",
        headSha: "c1d2e3f",
        status: SessionStatus.failed,
        questionCount: 3,
        generationModel: "anthropic/claude-sonnet-4.5",
        summary: "Adds WebSocket support for real-time notifications.",
        failureMessage:
          "Token budget exceeded (52,400 / 50,000 tokens). Merge blocked because the token budget fallback is set to fail.",
        createdAt: ago(24),
        updatedAt: ago(23),
      },
      {
        id: "sess_5",
        repositoryOwner: "acme-inc",
        repositoryName: "web-dashboard",
        pullNumber: 85,
        authorLogin: "dan-ops",
        headSha: "e4f5a6b",
        status: SessionStatus.passed,
        questionCount: 2,
        generationModel: "anthropic/claude-sonnet-4.5",
        summary: "Updates deployment configuration for staging environment.",
        createdAt: ago(48),
        updatedAt: ago(46),
      },
      {
        id: "sess_6",
        repositoryOwner: "acme-inc",
        repositoryName: "api-gateway",
        pullNumber: 135,
        authorLogin: "bob-eng",
        headSha: "b7c8d9e",
        status: SessionStatus.passed,
        questionCount: 5,
        generationModel: "anthropic/claude-sonnet-4.5",
        summary: "Implements database migration framework with rollback support.",
        failureMessage:
          "Token budget exceeded (31,200 / 30,000 tokens). Quiz skipped to avoid excessive charges.",
        createdAt: ago(72),
        updatedAt: ago(70),
      },
    ],
    sessionStats: {
      total: 6,
      awaiting: 1,
      passed: 3,
      failed: 1,
      skipped: 1,
      budgetExceeded: 2,
    },
    attemptStats: {
      totalAttempts: 8,
      passedAttempts: 4,
      failedAttempts: 4,
      uniqueAuthors: 4,
    },
  };
}

export function mockModels() {
  return [
    { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", contextLength: 200000 },
    { id: "anthropic/claude-opus-4.1", name: "Claude Opus 4.1", contextLength: 200000 },
    { id: "openai/gpt-4o", name: "GPT-4o", contextLength: 128000 },
  ];
}
