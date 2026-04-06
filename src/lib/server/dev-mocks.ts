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
        type: "Organization"
      }
    },
    {
      id: 202,
      account: {
        login: "alice-dev",
        avatar_url: mockAvatar("D", "#7c3aed"),
        type: "User"
      }
    },
    {
      id: 303,
      account: {
        login: "bob-corp",
        avatar_url: mockAvatar("B", "#059669"),
        type: "Organization"
      }
    },
    {
      id: 404,
      account: {
        login: "carol",
        avatar_url: mockAvatar("C", "#b45309"),
        type: "User"
      }
    }
  ];
}

export function mockSettings(installationId: string): SettingsRecord {
  // 101 = acme-inc (Org, paid)
  // 202 = alice-dev (User, free)
  // 303 = bob-corp (Org, free — would be blocked on quiz generation)
  // 404 = carol (User, paid)
  const planMap: Record<string, { accountType: string; marketplacePlan: "free" | "paid" }> = {
    "101": { accountType: "Organization", marketplacePlan: "paid" },
    "202": { accountType: "User",         marketplacePlan: "free" },
    "303": { accountType: "Organization", marketplacePlan: "free" },
    "404": { accountType: "User",         marketplacePlan: "paid" }
  };
  const { accountType, marketplacePlan } = planMap[installationId] ?? { accountType: "User", marketplacePlan: "free" };

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
    llmMaxJsonAttempts: 2,
    allowBestEffortFallback: true,
    retryMode: "same_quiz",
    skipBots: true,
    skipForks: true,
    customSystemPrompt: "",
    customQuizInstructions: ""
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
            { key: "C", text: "Questions can have any number of options." }
          ],
          correctOption: "A",
          explanation: "The quiz was updated to require exactly 3 options per question.",
          diffAnchors: ["src/lib/server/openai.ts", "src/lib/server/quiz.ts"],
          focus: "behavior"
        },
        {
          id: "q2",
          prompt: "What is the default answer mode in the mock dev session?",
          options: [
            { key: "A", text: "Generate a brand new quiz after every wrong answer." },
            { key: "B", text: "Explain mistakes and retry the same quiz." },
            { key: "C", text: "Only a maintainer can trigger any retry." }
          ],
          correctOption: "B",
          explanation: "The default retry behavior is the same-quiz mode that shows explanations.",
          diffAnchors: ["src/lib/server/config.ts", "src/routes/settings/[installationId]/+page.svelte"],
          focus: "implementation"
        },
        {
          id: "q3",
          prompt: "Why do these dev mocks exist?",
          options: [
            { key: "A", text: "To let local pages open without real GitHub auth, app installs, or database state." },
            { key: "B", text: "To permanently replace production data with static fixtures." },
            { key: "C", text: "To disable all validation logic in development." }
          ],
          correctOption: "A",
          explanation: "The mocks are dev-only and keep local preview flows usable without live integrations.",
          diffAnchors: ["src/lib/server/dev-mocks.ts"],
          focus: "risk"
        }
      ]
    }
  };
}

export function mockModels() {
  return [
    { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", contextLength: 200000 },
    { id: "anthropic/claude-opus-4.1", name: "Claude Opus 4.1", contextLength: 200000 },
    { id: "openai/gpt-4o", name: "GPT-4o", contextLength: 128000 }
  ];
}
