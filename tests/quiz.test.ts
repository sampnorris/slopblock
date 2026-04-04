import test from "node:test";
import assert from "node:assert/strict";
import { normalizeQuizPayload, validateQuizPayload } from "../src/quiz.js";

test("normalizeQuizPayload converts string options into keyed options", () => {
  const quiz = normalizeQuizPayload({
    summary: "summary",
    questions: [
      {
        prompt: "What changed?",
        options: ["first", "second", "third", "fourth"],
        correctOption: "second",
        explanation: "because",
        diffAnchors: ["src/file.ts"]
      }
    ]
  });

  assert.equal(quiz.questions.length, 1);
  assert.deepEqual(
    quiz.questions[0].options.map((option) => option.key),
    ["A", "B", "C", "D"]
  );
  assert.equal(quiz.questions[0].correctOption, "B");
});

test("validateQuizPayload rejects empty or malformed questions", () => {
  const issues = validateQuizPayload({
    summary: "summary",
    questions: []
  });

  assert.ok(issues.some((issue) => issue.includes("did not contain any valid questions")));
});
