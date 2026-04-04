import test from "node:test";
import assert from "node:assert/strict";
import { buildQuizComment, gradeAnswers, parseAnswers, parseStateFromComment } from "../src/comment-state.js";
import type { QuizPayload, SlopblockState } from "../src/types.js";

test("parseAnswers reads template replies", () => {
  const parsed = parseAnswers("slopblock answers\n1: b\n2: D\n");
  assert.ok(parsed);
  assert.equal(parsed?.answers.get(1), "B");
  assert.equal(parsed?.answers.get(2), "D");
});

test("state survives comment encoding", () => {
  const state: SlopblockState = {
    version: 1,
    prNumber: 42,
    headSha: "abc1234",
    status: "awaiting_answer",
    attempt: 1,
    generatedAt: new Date().toISOString(),
    retryMode: "new_quiz",
    quiz: {
      summary: "summary",
      questions: [
        {
          id: "q1",
          prompt: "What changed?",
          options: [
            { key: "A", text: "one" },
            { key: "B", text: "two" },
            { key: "C", text: "three" },
            { key: "D", text: "four" }
          ],
          correctOption: "B",
          explanation: "because",
          diffAnchors: ["src/a.ts"],
          focus: "behavior"
        }
      ]
    }
  };
  const body = buildQuizComment(state);
  const parsed = parseStateFromComment(body);
  assert.equal(parsed?.quiz?.questions[0].correctOption, "B");
});

test("gradeAnswers requires exact correct options", () => {
  const quiz: QuizPayload = {
    summary: "summary",
    questions: [
      {
        id: "q1",
        prompt: "What changed?",
        options: [
          { key: "A", text: "one" },
          { key: "B", text: "two" },
          { key: "C", text: "three" },
          { key: "D", text: "four" }
        ],
        correctOption: "C" as const,
        explanation: "because",
        diffAnchors: ["src/a.ts"],
        focus: "risk" as const
      }
    ]
  };
  const parsed = parseAnswers("slopblock answers\n1: C\n");
  assert.ok(parsed);
  const result = gradeAnswers(quiz, parsed!);
  assert.equal(result.passed, true);
});
