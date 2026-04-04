import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";

test("loadConfig returns defaults when config file is missing", () => {
  const workspace = mkdtempSync(join(tmpdir(), "slopblock-"));
  const config = loadConfig(".github/slopblock.yml", workspace);
  assert.equal(config.checkName, "slopblock");
  assert.equal(config.questionCount.min, 2);
  assert.equal(config.retryMode, "new_quiz");
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
      "llm:",
      "  generationModel: model-a",
      "  validationModel: model-b",
      "  skipModel: model-c",
      "heuristics:",
      "  skipBots: false"
    ].join("\n")
  );

  const config = loadConfig(".github/slopblock.yml", workspace);
  assert.equal(config.checkName, "custom-check");
  assert.equal(config.retryMode, "same_quiz");
  assert.equal(config.questionCount.min, 1);
  assert.equal(config.questionCount.max, 3);
  assert.equal(config.heuristics.skipBots, false);
  assert.equal(config.llm.generationModel, "model-a");
  assert.equal(config.llm.validationModel, "model-b");
  assert.equal(config.llm.skipModel, "model-c");
});
