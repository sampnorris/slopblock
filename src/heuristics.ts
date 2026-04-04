import type { ChangedFile, SkipDecision, SlopblockConfig } from "./types.js";
import { normalizeWhitespace, pathMatches } from "./util.js";

function changedLineTexts(patch: string | undefined, prefix: "+" | "-"): string[] {
  if (!patch) {
    return [];
  }

  return patch
    .split("\n")
    .filter((line) => line.startsWith(prefix) && !line.startsWith(`${prefix}${prefix}${prefix}`))
    .map((line) => normalizeWhitespace(line.slice(1)))
    .filter(Boolean);
}

function isWhitespaceOrFormattingOnly(file: ChangedFile): boolean {
  const added = changedLineTexts(file.patch, "+").sort();
  const removed = changedLineTexts(file.patch, "-").sort();
  if (added.length === 0 && removed.length === 0) {
    return false;
  }
  return JSON.stringify(added) === JSON.stringify(removed);
}

function isDependencyFile(path: string, config: SlopblockConfig): boolean {
  return config.heuristics.dependencyFiles.some((file) => path.endsWith(file));
}

function isDocsOnly(files: ChangedFile[], config: SlopblockConfig): boolean {
  return files.every((file) => pathMatches(file.filename, config.heuristics.docsGlobs));
}

function isTestsOnly(files: ChangedFile[], config: SlopblockConfig): boolean {
  return files.every((file) => pathMatches(file.filename, config.heuristics.testGlobs));
}

function isDependencyOnly(files: ChangedFile[], config: SlopblockConfig): boolean {
  return files.every((file) => isDependencyFile(file.filename, config));
}

function isTinyCopyChange(files: ChangedFile[], config: SlopblockConfig): boolean {
  const totalLines = files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
  if (totalLines > config.heuristics.tinyChangeMaxLines) {
    return false;
  }

  return files.every((file) => config.heuristics.tinyCopyExtensions.some((extension) => file.filename.endsWith(extension)));
}

function touchesRiskyPaths(files: ChangedFile[], config: SlopblockConfig): boolean {
  return files.some((file) => pathMatches(file.filename, config.heuristics.riskyGlobs));
}

export function computeQuestionCount(files: ChangedFile[], config: SlopblockConfig): number {
  const totalLines = files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
  const risky = touchesRiskyPaths(files, config);

  if (risky || totalLines > 300 || files.length > 8) {
    return config.questionCount.max;
  }
  if (totalLines > 120 || files.length > 4) {
    return Math.min(config.questionCount.max, config.questionCount.min + 2);
  }
  if (totalLines > 30 || files.length > 2) {
    return Math.min(config.questionCount.max, config.questionCount.min + 1);
  }
  return config.questionCount.min;
}

export function initialSkipDecision(files: ChangedFile[], config: SlopblockConfig): SkipDecision {
  if (files.length === 0) {
    return { outcome: "skip", reason: "No diff detected on the pull request.", certainty: "high" };
  }

  if (isDocsOnly(files, config)) {
    return { outcome: "skip", reason: "Docs-only pull request matched configured skip rules.", certainty: "high" };
  }

  if (isTestsOnly(files, config)) {
    return { outcome: "skip", reason: "Tests-only pull request matched configured skip rules.", certainty: "high" };
  }

  if (isDependencyOnly(files, config)) {
    return { outcome: "skip", reason: "Dependency-only pull request matched configured skip rules.", certainty: "high" };
  }

  if (isTinyCopyChange(files, config)) {
    return { outcome: "skip", reason: "Tiny copy-only change matched configured skip rules.", certainty: "high" };
  }

  if (files.every(isWhitespaceOrFormattingOnly)) {
    return { outcome: "skip", reason: "Formatting-only pull request matched configured skip rules.", certainty: "high" };
  }

  const totalLines = files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
  if (!touchesRiskyPaths(files, config) && totalLines <= config.heuristics.tinyChangeMaxLines * 2) {
    return {
      outcome: "quiz",
      reason: "Small diff, but not confidently obvious enough to skip without model review.",
      certainty: "low"
    };
  }

  return { outcome: "quiz", reason: "Diff is substantial enough to require a quiz.", certainty: "high" };
}
