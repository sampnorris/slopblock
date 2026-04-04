import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import type { SlopblockConfig } from "./types.js";

const DEFAULT_CONFIG: SlopblockConfig = {
  checkName: "slopblock",
  questionCount: {
    min: 2,
    max: 5
  },
  passRule: {
    requireAllCorrect: true
  },
  retryMode: "new_quiz",
  contextBudget: {
    maxRepoFiles: 250,
    maxRepoMapEntries: 120,
    maxSnippetFiles: 12,
    maxSnippetChars: 12000
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
      "go.sum"
    ],
    riskyGlobs: [
      "auth/",
      "security/",
      "migrations/",
      "infra/",
      ".github/workflows/",
      "api/",
      "src/routes/api/"
    ],
    skipForkPullRequests: true,
    skipBots: true
  },
  llm: {
    model: "gpt-4.1-mini"
  }
};

function mergeArrays<T>(base: T[], override: unknown): T[] {
  return Array.isArray(override) ? (override as T[]) : base;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function loadConfig(configPath: string, workspace = process.env.GITHUB_WORKSPACE ?? process.cwd()): SlopblockConfig {
  const fullPath = join(workspace, configPath);
  if (!existsSync(fullPath)) {
    return DEFAULT_CONFIG;
  }

  const raw = YAML.parse(readFileSync(fullPath, "utf8")) as Record<string, unknown>;
  const questionCount = asObject(raw.questionCount);
  const passRule = asObject(raw.passRule);
  const contextBudget = asObject(raw.contextBudget);
  const heuristics = asObject(raw.heuristics);
  const llm = asObject(raw.llm);

  return {
    checkName: typeof raw.checkName === "string" ? raw.checkName : DEFAULT_CONFIG.checkName,
    questionCount: {
      min: typeof questionCount.min === "number" ? questionCount.min : DEFAULT_CONFIG.questionCount.min,
      max: typeof questionCount.max === "number" ? questionCount.max : DEFAULT_CONFIG.questionCount.max
    },
    passRule: {
      requireAllCorrect:
        typeof passRule.requireAllCorrect === "boolean"
          ? passRule.requireAllCorrect
          : DEFAULT_CONFIG.passRule.requireAllCorrect
    },
    retryMode:
      raw.retryMode === "same_quiz" || raw.retryMode === "new_quiz" || raw.retryMode === "maintainer_rerun"
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
          : DEFAULT_CONFIG.contextBudget.maxSnippetChars
    },
    heuristics: {
      tinyChangeMaxLines:
        typeof heuristics.tinyChangeMaxLines === "number"
          ? heuristics.tinyChangeMaxLines
          : DEFAULT_CONFIG.heuristics.tinyChangeMaxLines,
      tinyCopyExtensions: mergeArrays(DEFAULT_CONFIG.heuristics.tinyCopyExtensions, heuristics.tinyCopyExtensions),
      docsGlobs: mergeArrays(DEFAULT_CONFIG.heuristics.docsGlobs, heuristics.docsGlobs),
      testGlobs: mergeArrays(DEFAULT_CONFIG.heuristics.testGlobs, heuristics.testGlobs),
      dependencyFiles: mergeArrays(DEFAULT_CONFIG.heuristics.dependencyFiles, heuristics.dependencyFiles),
      riskyGlobs: mergeArrays(DEFAULT_CONFIG.heuristics.riskyGlobs, heuristics.riskyGlobs),
      skipForkPullRequests:
        typeof heuristics.skipForkPullRequests === "boolean"
          ? heuristics.skipForkPullRequests
          : DEFAULT_CONFIG.heuristics.skipForkPullRequests,
      skipBots:
        typeof heuristics.skipBots === "boolean" ? heuristics.skipBots : DEFAULT_CONFIG.heuristics.skipBots
    },
    llm: {
      model: typeof llm.model === "string" ? llm.model : DEFAULT_CONFIG.llm.model,
      baseUrl: typeof llm.baseUrl === "string" ? llm.baseUrl : undefined,
      apiKey: typeof llm.apiKey === "string" ? llm.apiKey : undefined
    }
  };
}
