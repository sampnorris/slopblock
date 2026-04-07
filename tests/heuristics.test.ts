import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/lib/server/config.js";
import { computeQuestionCount, initialSkipDecision } from "../src/lib/server/heuristics.js";
import type { ChangedFile } from "../src/lib/server/types.js";

const config = loadConfig(".github/slopblock.yml", process.cwd());

test("initialSkipDecision skips docs-only pull requests", () => {
  const files: ChangedFile[] = [
    {
      filename: "docs/intro.md",
      status: "modified",
      additions: 3,
      deletions: 1,
      changes: 4,
      patch: "@@\n-old\n+new\n",
    },
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
      patch: "@@\n-export const enabled = false;\n+export const enabled = true;\n",
    },
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
      patch: "@@\n-old\n+new\n",
    },
  ];

  const count = computeQuestionCount(files, config);
  assert.equal(count, config.questionCount.max);
});

test("initialSkipDecision skips tests-only pull requests", () => {
  const files: ChangedFile[] = [
    {
      filename: "tests/auth.test.ts",
      status: "added",
      additions: 20,
      deletions: 0,
      changes: 20,
      patch: "@@\n+test code\n",
    },
    {
      filename: "__tests__/util.spec.ts",
      status: "modified",
      additions: 5,
      deletions: 2,
      changes: 7,
      patch: "@@\n-old\n+new\n",
    },
  ];

  const result = initialSkipDecision(files, config);
  assert.equal(result.outcome, "skip");
  assert.match(result.reason, /Tests-only/);
});

test("initialSkipDecision skips dependency-only pull requests", () => {
  const files: ChangedFile[] = [
    {
      filename: "package.json",
      status: "modified",
      additions: 2,
      deletions: 2,
      changes: 4,
      patch: "@@\n-old\n+new\n",
    },
    {
      filename: "pnpm-lock.yaml",
      status: "modified",
      additions: 100,
      deletions: 80,
      changes: 180,
      patch: "@@\n-old\n+new\n",
    },
  ];

  const result = initialSkipDecision(files, config);
  assert.equal(result.outcome, "skip");
  assert.match(result.reason, /Dependency-only/);
});

test("initialSkipDecision skips tiny copy-only changes", () => {
  const files: ChangedFile[] = [
    {
      filename: "README.md",
      status: "modified",
      additions: 1,
      deletions: 1,
      changes: 2,
      patch: "@@\n-old typo\n+old fixed\n",
    },
  ];

  const result = initialSkipDecision(files, config);
  assert.equal(result.outcome, "skip");
});

test("initialSkipDecision skips formatting-only changes (whitespace reformat)", () => {
  const files: ChangedFile[] = [
    {
      filename: "src/app.ts",
      status: "modified",
      additions: 3,
      deletions: 3,
      changes: 6,
      patch: "@@\n-  const x = 1;\n-  const y = 2;\n-  const z = 3;\n+    const x = 1;\n+    const y = 2;\n+    const z = 3;\n",
    },
  ];

  const result = initialSkipDecision(files, config);
  assert.equal(result.outcome, "skip");
  assert.match(result.reason, /Formatting-only/);
});

test("initialSkipDecision skips empty file lists", () => {
  const result = initialSkipDecision([], config);
  assert.equal(result.outcome, "skip");
  assert.match(result.reason, /No diff/);
});

test("initialSkipDecision returns high-certainty quiz for large diffs", () => {
  const files: ChangedFile[] = [
    {
      filename: "src/core.ts",
      status: "modified",
      additions: 200,
      deletions: 100,
      changes: 300,
      patch: "@@\n-old\n+new\n",
    },
  ];

  const result = initialSkipDecision(files, config);
  assert.equal(result.outcome, "quiz");
  assert.equal(result.certainty, "high");
});

test("computeQuestionCount returns min for small diffs", () => {
  const files: ChangedFile[] = [
    {
      filename: "src/util.ts",
      status: "modified",
      additions: 5,
      deletions: 3,
      changes: 8,
      patch: "@@\n-old\n+new\n",
    },
  ];

  const count = computeQuestionCount(files, config);
  assert.equal(count, config.questionCount.min);
});

test("computeQuestionCount scales for medium diffs", () => {
  const files: ChangedFile[] = [
    {
      filename: "src/service.ts",
      status: "modified",
      additions: 80,
      deletions: 50,
      changes: 130,
      patch: "@@\n-old\n+new\n",
    },
  ];

  const count = computeQuestionCount(files, config);
  assert.ok(count > config.questionCount.min);
  assert.ok(count <= config.questionCount.max);
});
