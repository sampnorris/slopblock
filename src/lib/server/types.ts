export type RetryMode = "same_quiz" | "new_quiz" | "maintainer_rerun";
export type TokenBudgetFallback = "pass" | "fail";

export interface SlopblockConfig {
  checkName: string;
  questionCount: {
    min: number;
    max: number;
  };
  quizGeneration: {
    maxAttempts: number;
    allowBestEffortFallback: boolean;
  };
  passRule: {
    requireAllCorrect: boolean;
    allowedWrongAnswers: number;
  };
  retryMode: RetryMode;
  contextBudget: {
    maxRepoFiles: number;
    maxRepoMapEntries: number;
    maxSnippetFiles: number;
    maxSnippetChars: number;
  };
  heuristics: {
    tinyChangeMaxLines: number;
    tinyCopyExtensions: string[];
    docsGlobs: string[];
    testGlobs: string[];
    dependencyFiles: string[];
    riskyGlobs: string[];
    skipForkPullRequests: boolean;
    skipBots: boolean;
  };
  llm: {
    model?: string;
    generationModel: string;
    validationModel: string;
    skipModel: string;
    baseUrl?: string;
    apiKey?: string;
  };
  customSystemPrompt?: string;
  customQuizInstructions?: string;
  maxTokenBudget?: number;
  tokenBudgetFallback: TokenBudgetFallback;
}

export interface ChangedFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export interface SkipDecision {
  outcome: "skip" | "quiz";
  reason: string;
  certainty: "high" | "medium" | "low";
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: Array<{
    key: "A" | "B" | "C" | "D" | "E";
    text: string;
  }>;
  correctOption: "A" | "B" | "C" | "D" | "E";
  explanation: string;
  diffAnchors: string[];
  focus: "behavior" | "risk" | "implementation";
}

export interface QuizPayload {
  summary: string;
  questions: QuizQuestion[];
}

export interface QuizValidation {
  valid: boolean;
  issues: string[];
}

export interface SlopblockState {
  version: number;
  prNumber: number;
  headSha: string;
  status: "awaiting_answer" | "passed" | "skipped" | "failed";
  attempt: number;
  generatedAt: string;
  retryMode: RetryMode;
  quiz?: QuizPayload;
  failReason?: string;
  skipReason?: string;
}

export interface ParsedAnswers {
  answers: Map<number, string>;
  raw: string;
}

export interface RepoContext {
  repoMap: string[];
  changedFileContexts: Array<{
    path: string;
    summary: string;
    content: string;
  }>;
  relatedSnippets: Array<{
    path: string;
    reason: string;
    snippet: string;
  }>;
}
