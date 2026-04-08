import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import type { SlopblockConfig } from "./types.js";

const DEFAULT_CONFIG: SlopblockConfig = {
  checkName: "slopblock",
  questionCount: {
    min: 2,
    max: 5,
  },
  quizGeneration: {
    maxAttempts: 3,
    allowBestEffortFallback: true,
  },
  passRule: {
    requireAllCorrect: true,
    allowedWrongAnswers: 0,
  },
  retryMode: "same_quiz",
  contextBudget: {
    maxRepoFiles: 250,
    maxRepoMapEntries: 120,
    maxSnippetFiles: 12,
    maxSnippetChars: 12000,
  },
  heuristics: {
    tinyChangeMaxLines: 4,
    tinyCopyExtensions: [".md", ".mdx", ".txt", ".rst", ".yml", ".yaml", ".json"],
    docsGlobs: ["docs/", "**/*.md", "**/*.mdx", "**/*.rst"],
    testGlobs: ["test/", "tests/", "__tests__/", "**/*.test.", "**/*.spec."],
    dependencyFiles: [
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "bun.lock",
      "bun.lockb",
      "poetry.lock",
      "Cargo.lock",
      "go.mod",
      "go.sum",
    ],
    riskyGlobs: [
      "auth/",
      "security/",
      "migrations/",
      "infra/",
      ".github/workflows/",
      "api/",
      "src/routes/api/",
    ],
    skipForkPullRequests: true,
    skipBots: true,
  },
  llm: {
    generationModel: "anthropic/claude-sonnet-4.5",
    validationModel: "anthropic/claude-opus-4.1",
    skipModel: "anthropic/claude-sonnet-4.5",
  },
  maxTokenBudget: 100_000,
  tokenBudgetFallback: "pass",
};

function mergeArrays<T>(base: T[], override: unknown): T[] {
  return Array.isArray(override) ? (override as T[]) : base;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function parseConfig(rawValue: Record<string, unknown>): SlopblockConfig {
  const raw = rawValue;
  const questionCount = asObject(raw.questionCount);
  const quizGeneration = asObject(raw.quizGeneration);
  const passRule = asObject(raw.passRule);
  const allowedWrongAnswersRaw =
    typeof passRule.allowedWrongAnswers === "number" ? passRule.allowedWrongAnswers : undefined;
  const allowedWrongAnswers =
    allowedWrongAnswersRaw != null && Number.isFinite(allowedWrongAnswersRaw)
      ? Math.max(0, Math.floor(allowedWrongAnswersRaw))
      : DEFAULT_CONFIG.passRule.allowedWrongAnswers;
  const contextBudget = asObject(raw.contextBudget);
  const heuristics = asObject(raw.heuristics);
  const llm = asObject(raw.llm);

  return {
    checkName: typeof raw.checkName === "string" ? raw.checkName : DEFAULT_CONFIG.checkName,
    questionCount: {
      min:
        typeof questionCount.min === "number"
          ? questionCount.min
          : DEFAULT_CONFIG.questionCount.min,
      max:
        typeof questionCount.max === "number"
          ? questionCount.max
          : DEFAULT_CONFIG.questionCount.max,
    },
    quizGeneration: {
      maxAttempts:
        typeof quizGeneration.maxAttempts === "number"
          ? quizGeneration.maxAttempts
          : DEFAULT_CONFIG.quizGeneration.maxAttempts,
      allowBestEffortFallback:
        typeof quizGeneration.allowBestEffortFallback === "boolean"
          ? quizGeneration.allowBestEffortFallback
          : DEFAULT_CONFIG.quizGeneration.allowBestEffortFallback,
    },
    passRule: {
      requireAllCorrect:
        typeof passRule.requireAllCorrect === "boolean"
          ? passRule.requireAllCorrect
          : DEFAULT_CONFIG.passRule.requireAllCorrect,
      allowedWrongAnswers,
    },
    retryMode:
      raw.retryMode === "same_quiz" ||
      raw.retryMode === "new_quiz" ||
      raw.retryMode === "maintainer_rerun"
        ? raw.retryMode
        : DEFAULT_CONFIG.retryMode,
    contextBudget: {
      maxRepoFiles:
        typeof contextBudget.maxRepoFiles === "number"
          ? contextBudget.maxRepoFiles
          : DEFAULT_CONFIG.contextBudget.maxRepoFiles,
      maxRepoMapEntries:
        typeof contextBudget.maxRepoMapEntries === "number"
          ? contextBudget.maxRepoMapEntries
          : DEFAULT_CONFIG.contextBudget.maxRepoMapEntries,
      maxSnippetFiles:
        typeof contextBudget.maxSnippetFiles === "number"
          ? contextBudget.maxSnippetFiles
          : DEFAULT_CONFIG.contextBudget.maxSnippetFiles,
      maxSnippetChars:
        typeof contextBudget.maxSnippetChars === "number"
          ? contextBudget.maxSnippetChars
          : DEFAULT_CONFIG.contextBudget.maxSnippetChars,
    },
    heuristics: {
      tinyChangeMaxLines:
        typeof heuristics.tinyChangeMaxLines === "number"
          ? heuristics.tinyChangeMaxLines
          : DEFAULT_CONFIG.heuristics.tinyChangeMaxLines,
      tinyCopyExtensions: mergeArrays(
        DEFAULT_CONFIG.heuristics.tinyCopyExtensions,
        heuristics.tinyCopyExtensions,
      ),
      docsGlobs: mergeArrays(DEFAULT_CONFIG.heuristics.docsGlobs, heuristics.docsGlobs),
      testGlobs: mergeArrays(DEFAULT_CONFIG.heuristics.testGlobs, heuristics.testGlobs),
      dependencyFiles: mergeArrays(
        DEFAULT_CONFIG.heuristics.dependencyFiles,
        heuristics.dependencyFiles,
      ),
      riskyGlobs: mergeArrays(DEFAULT_CONFIG.heuristics.riskyGlobs, heuristics.riskyGlobs),
      skipForkPullRequests:
        typeof heuristics.skipForkPullRequests === "boolean"
          ? heuristics.skipForkPullRequests
          : DEFAULT_CONFIG.heuristics.skipForkPullRequests,
      skipBots:
        typeof heuristics.skipBots === "boolean"
          ? heuristics.skipBots
          : DEFAULT_CONFIG.heuristics.skipBots,
    },
    llm: {
      model: typeof llm.model === "string" ? llm.model : undefined,
      generationModel:
        typeof llm.generationModel === "string"
          ? llm.generationModel
          : typeof llm.model === "string"
            ? llm.model
            : DEFAULT_CONFIG.llm.generationModel,
      validationModel:
        typeof llm.validationModel === "string"
          ? llm.validationModel
          : typeof llm.model === "string"
            ? llm.model
            : DEFAULT_CONFIG.llm.validationModel,
      skipModel:
        typeof llm.skipModel === "string"
          ? llm.skipModel
          : typeof llm.model === "string"
            ? llm.model
            : DEFAULT_CONFIG.llm.skipModel,
      baseUrl: typeof llm.baseUrl === "string" ? llm.baseUrl : undefined,
      apiKey: typeof llm.apiKey === "string" ? llm.apiKey : undefined,
    },
    maxTokenBudget:
      typeof raw.maxTokenBudget === "number" && raw.maxTokenBudget > 0
        ? raw.maxTokenBudget
        : DEFAULT_CONFIG.maxTokenBudget,
    tokenBudgetFallback:
      raw.tokenBudgetFallback === "pass" || raw.tokenBudgetFallback === "fail"
        ? raw.tokenBudgetFallback
        : DEFAULT_CONFIG.tokenBudgetFallback,
  };
}

export function loadConfigFromString(contents: string | undefined): SlopblockConfig {
  if (!contents) {
    return DEFAULT_CONFIG;
  }

  return parseConfig((YAML.parse(contents) as Record<string, unknown>) ?? {});
}

export function loadConfig(
  configPath: string,
  workspace = process.env.GITHUB_WORKSPACE ?? process.cwd(),
): SlopblockConfig {
  const fullPath = join(workspace, configPath);
  if (!existsSync(fullPath)) {
    return DEFAULT_CONFIG;
  }

  return loadConfigFromString(readFileSync(fullPath, "utf8"));
}
