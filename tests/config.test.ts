import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/lib/server/config.js";

test("loadConfig returns defaults when config file is missing", () => {
  const workspace = mkdtempSync(join(tmpdir(), "slopblock-"));
  const config = loadConfig(".github/slopblock.yml", workspace);
  assert.equal(config.checkName, "slopblock");
  assert.equal(config.questionCount.min, 2);
  assert.equal(config.retryMode, "same_quiz");
  assert.equal(config.quizGeneration.maxAttempts, 3);
  assert.equal(config.quizGeneration.allowBestEffortFallback, true);
  assert.equal(config.llm.maxJsonAttempts, 2);
  assert.equal(config.llm.generationModel, "anthropic/claude-sonnet-4.5");
  assert.equal(config.llm.validationModel, "anthropic/claude-opus-4.1");
  assert.equal(config.llm.skipModel, "anthropic/claude-sonnet-4.5");
});

test("loadConfig merges overrides", () => {
  const workspace = mkdtempSync(join(tmpdir(), "slopblock-"));
  mkdirSync(join(workspace, ".github"));
  writeFileSync(
    join(workspace, ".github", "slopblock.yml"),
    [
      "checkName: custom-check",
      "retryMode: same_quiz",
      "questionCount:",
      "  min: 1",
      "  max: 3",
      "quizGeneration:",
      "  maxAttempts: 5",
      "  allowBestEffortFallback: false",
      "llm:",
      "  generationModel: model-a",
      "  validationModel: model-b",
      "  skipModel: model-c",
      "  maxJsonAttempts: 4",
      "heuristics:",
      "  skipBots: false"
    ].join("\n")
  );

  const config = loadConfig(".github/slopblock.yml", workspace);
  assert.equal(config.checkName, "custom-check");
  assert.equal(config.retryMode, "same_quiz");
  assert.equal(config.questionCount.min, 1);
  assert.equal(config.questionCount.max, 3);
  assert.equal(config.quizGeneration.maxAttempts, 5);
  assert.equal(config.quizGeneration.allowBestEffortFallback, false);
  assert.equal(config.llm.maxJsonAttempts, 4);
  assert.equal(config.heuristics.skipBots, false);
  assert.equal(config.llm.generationModel, "model-a");
  assert.equal(config.llm.validationModel, "model-b");
  assert.equal(config.llm.skipModel, "model-c");
});

test("installation config values remain available for provider selection", () => {
  const config = loadConfigFromStringForTest([
    "llm:",
    "  baseUrl: https://openrouter.ai/api/v1",
    "  apiKey: openrouter-key",
    "  generationModel: anthropic/claude-sonnet-4.5"
  ].join("\n"));

  assert.equal(config.llm.baseUrl, "https://openrouter.ai/api/v1");
  assert.equal(config.llm.apiKey, "openrouter-key");
  assert.equal(config.llm.generationModel, "anthropic/claude-sonnet-4.5");
});

test("loadConfig keeps explicit blank model values instead of defaulting", () => {
  const config = loadConfigFromStringForTest([
    "llm:",
    "  generationModel: ''",
    "  validationModel: ''",
    "  skipModel: ''"
  ].join("\n"));

  assert.equal(config.llm.generationModel, "");
  assert.equal(config.llm.validationModel, "");
  assert.equal(config.llm.skipModel, "");
});

function loadConfigFromStringForTest(contents: string) {
  const workspace = mkdtempSync(join(tmpdir(), "slopblock-"));
  mkdirSync(join(workspace, ".github"));
  writeFileSync(join(workspace, ".github", "slopblock.yml"), contents);
  return loadConfig(".github/slopblock.yml", workspace);
}
