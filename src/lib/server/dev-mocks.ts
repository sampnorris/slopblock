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
//   101 - acme-inc (Org, paid via BMAC)
//   202 - alice-dev (User, free — 10/day limit)
//   303 - bob-corp (Org, free — 10/day limit)
//   404 - carol (User, paid via BMAC)
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
  // 101 = acme-inc (Org, paid via BMAC)
  // 202 = alice-dev (User, free — 10/day limit)
  // 303 = bob-corp (Org, free — 10/day limit)
  // 404 = carol (User, paid via BMAC)
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
    bmacActive: marketplacePlan === "paid",
    githubMarketplaceActive: false,
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
    supporterEmail: marketplacePlan === "paid" ? "supporter@example.com" : undefined,
  };
}

function defaultMockQuiz() {
  return {
    summary: "This mock PR updates quiz generation rules and improves the dev preview flow.",
    questions: [
      {
        id: "q1",
        prompt: "What changed about answer options in the quiz?",
        options: [
          { key: "A" as const, text: "Questions now use exactly `3` options." },
          { key: "B" as const, text: "Questions now use exactly `5` options." },
          { key: "C" as const, text: "Questions can have any number of options." },
        ],
        correctOption: "A" as const,
        explanation: "The quiz was updated to require exactly 3 options per question.",
        diffAnchors: ["src/lib/server/openai.ts", "src/lib/server/quiz.ts"],
        focus: "behavior" as const,
      },
      {
        id: "q2",
        prompt: "What is the default answer mode in the mock dev session?",
        options: [
          { key: "A" as const, text: "Generate a brand new quiz after every wrong answer." },
          { key: "B" as const, text: "Explain mistakes and retry the same quiz." },
          { key: "C" as const, text: "Only a maintainer can trigger any retry." },
        ],
        correctOption: "B" as const,
        explanation: "The default retry behavior is the same-quiz mode that shows explanations.",
        diffAnchors: [
          "src/lib/server/config.ts",
          "src/routes/settings/[installationId]/+page.svelte",
        ],
        focus: "implementation" as const,
      },
      {
        id: "q3",
        prompt: "Why do these dev mocks exist?",
        options: [
          {
            key: "A" as const,
            text: "To let local pages open without real GitHub auth, app installs, or database state.",
          },
          {
            key: "B" as const,
            text: "To permanently replace production data with static fixtures.",
          },
          { key: "C" as const, text: "To disable all validation logic in development." },
        ],
        correctOption: "A" as const,
        explanation:
          "The mocks are dev-only and keep local preview flows usable without live integrations.",
        diffAnchors: ["src/lib/server/dev-mocks.ts"],
        focus: "risk" as const,
      },
    ],
  };
}

export function mockSession(token: string): SessionRecord {
  const baseQuiz = defaultMockQuiz();

  const baseSession: SessionRecord = {
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
    questionCount: baseQuiz.questions.length,
    retryMode: "same_quiz",
    allowedWrongAnswers: 0,
    generationModel: "anthropic/claude-sonnet-4.5",
    validationModel: "anthropic/claude-opus-4.1",
    summary: baseQuiz.summary,
    quiz: baseQuiz,
  };

  if (token === "sess_1") {
    return {
      ...baseSession,
      repositoryName: "api-gateway",
      pullNumber: 142,
      headSha: "a1b2c3d",
      summary: "Adds rate limiting middleware to the API gateway with Redis-backed sliding window.",
      quiz: {
        ...baseQuiz,
        summary:
          "Adds rate limiting middleware to the API gateway with Redis-backed sliding window.",
      },
    };
  }

  if (token === "sess_2") {
    return {
      ...baseSession,
      repositoryName: "api-gateway",
      pullNumber: 141,
      headSha: "111aaaa",
      questionCount: 4,
      summary: "Swaps the request signer for a new HMAC pipeline.",
      isRegenerating: true,
      quiz: {
        ...baseQuiz,
        summary: "Swaps the request signer for a new HMAC pipeline.",
      },
    };
  }

  if (token === "sess_3") {
    return {
      ...baseSession,
      repositoryName: "api-gateway",
      pullNumber: 140,
      headSha: "d4e5f6a",
      authorLogin: "bob-eng",
      status: SessionStatus.passed,
      questionCount: 4,
      summary:
        "Refactors authentication flow to use OIDC provider instead of custom JWT validation.",
    };
  }

  if (token === "sess_4") {
    return {
      ...baseSession,
      repositoryName: "api-gateway",
      pullNumber: 139,
      headSha: "ab12cd3",
      authorLogin: "eve-sec",
      status: SessionStatus.failed,
      questionCount: 0,
      summary: "Locks down webhook verification for organization installs.",
      failureMessage: "Quiz not passed (1/3 correct). Fix your answers or generate a new quiz.",
      quiz: undefined,
    };
  }

  if (token === "sess_5") {
    return {
      ...baseSession,
      repositoryName: "web-dashboard",
      pullNumber: 87,
      headSha: "f7a8b9c",
      authorLogin: "carol",
      status: SessionStatus.skipped,
      questionCount: 0,
      summary: undefined,
      skipReason: "Docs-only pull request matched configured skip rules.",
      quiz: undefined,
    };
  }

  if (token === "sess_6") {
    return {
      ...baseSession,
      repositoryName: "web-dashboard",
      pullNumber: 85,
      headSha: "e4f5a6b",
      authorLogin: "dan-ops",
      status: SessionStatus.quota_exceeded,
      questionCount: 0,
      summary: undefined,
      failureMessage:
        "Token budget exceeded (31,200 / 30,000 tokens). Quiz skipped to avoid excessive charges.",
      quiz: undefined,
    };
  }

  return baseSession;
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
        pullNumber: 141,
        authorLogin: "alice-dev",
        headSha: "111aaaa",
        status: SessionStatus.awaiting_answer,
        isRegenerating: true,
        questionCount: 4,
        generationModel: "anthropic/claude-sonnet-4.5",
        summary: "Swaps the request signer for a new HMAC pipeline.",
        createdAt: ago(2),
        updatedAt: ago(1.75),
      },
      {
        id: "sess_3",
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
        id: "sess_4",
        repositoryOwner: "acme-inc",
        repositoryName: "api-gateway",
        pullNumber: 139,
        authorLogin: "eve-sec",
        headSha: "ab12cd3",
        status: SessionStatus.failed,
        questionCount: 3,
        generationModel: "anthropic/claude-sonnet-4.5",
        summary: "Locks down webhook verification for organization installs.",
        failureMessage: "Quiz not passed (1/3 correct). Fix your answers or generate a new quiz.",
        createdAt: ago(10),
        updatedAt: ago(9),
      },
      {
        id: "sess_5",
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
        id: "sess_6",
        repositoryOwner: "acme-inc",
        repositoryName: "web-dashboard",
        pullNumber: 85,
        authorLogin: "dan-ops",
        headSha: "e4f5a6b",
        status: SessionStatus.quota_exceeded,
        questionCount: 0,
        generationModel: "anthropic/claude-sonnet-4.5",
        summary: undefined,
        failureMessage:
          "Token budget exceeded (31,200 / 30,000 tokens). Quiz skipped to avoid excessive charges.",
        createdAt: ago(20),
        updatedAt: ago(19),
      },
    ],
    sessionStats: {
      total: 6,
      awaiting: 1,
      regenerating: 1,
      passed: 1,
      failed: 1,
      skipped: 1,
      budgetExceeded: 1,
    },
    attemptStats: {
      totalAttempts: 6,
      passedAttempts: 2,
      failedAttempts: 4,
      uniqueAuthors: 5,
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
