import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";
import { computeQuestionCount, initialSkipDecision } from "../src/heuristics.js";
import type { ChangedFile } from "../src/types.js";

const config = loadConfig(".github/slopblock.yml", process.cwd());

test("initialSkipDecision skips docs-only pull requests", () => {
  const files: ChangedFile[] = [
    {
      filename: "docs/intro.md",
      status: "modified",
      additions: 3,
      deletions: 1,
      changes: 4,
      patch: "@@\n-old\n+new\n"
    }
  ];

  const result = initialSkipDecision(files, config);
  assert.equal(result.outcome, "skip");
});

test("initialSkipDecision flags small non-obvious diffs for borderline review", () => {
  const files: ChangedFile[] = [
    {
      filename: "src/flag.ts",
      status: "modified",
      additions: 1,
      deletions: 1,
      changes: 2,
      patch: "@@\n-export const enabled = false;\n+export const enabled = true;\n"
    }
  ];

  const result = initialSkipDecision(files, config);
  assert.equal(result.outcome, "quiz");
  assert.equal(result.certainty, "low");
});

test("computeQuestionCount increases for risky or larger diffs", () => {
  const files: ChangedFile[] = [
    {
      filename: "auth/session.ts",
      status: "modified",
      additions: 40,
      deletions: 10,
      changes: 50,
      patch: "@@\n-old\n+new\n"
    }
  ];

  const count = computeQuestionCount(files, config);
  assert.equal(count, config.questionCount.max);
});
