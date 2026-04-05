import test from "node:test";
import assert from "node:assert/strict";
import { normalizeQuizPayload, validateQuizPayload } from "../src/lib/server/quiz.js";
import { gradeQuizAnswers } from "../src/lib/server/attempt-store.js";
import { SessionStatus } from "@prisma/client";
import type { SessionRecord } from "../src/lib/server/session-store.js";

const session: SessionRecord = {
  id: "session-1",
  installationId: 1,
  repositoryId: 1,
  repositoryOwner: "owner",
  repositoryName: "repo",
  pullNumber: 10,
  authorLogin: "alice",
  headSha: "abcdef123456",
  status: SessionStatus.awaiting_answer,
  currentQuestionIndex: 0,
  questionCount: 2,
  retryMode: "new_quiz",
  generationModel: "model-a",
  validationModel: "model-b",
  quiz: {
    summary: "summary",
    questions: [
      {
        id: "q1",
        prompt: "One?",
        options: [
          { key: "A", text: "A" },
          { key: "B", text: "B" }
        ],
        correctOption: "A",
        explanation: "because",
        diffAnchors: [],
        focus: "behavior"
      },
      {
        id: "q2",
        prompt: "Two?",
        options: [
          { key: "A", text: "A" },
          { key: "B", text: "B" }
        ],
        correctOption: "B",
        explanation: "because",
        diffAnchors: [],
        focus: "risk"
      }
    ]
  }
};

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

test("gradeQuizAnswers computes score and pass state", () => {
  const graded = gradeQuizAnswers(session, { q1: "A", q2: "A" });

  assert.deepEqual(graded.answers, { q1: "A", q2: "A" });
  assert.equal(graded.questionCount, 2);
  assert.equal(graded.correctCount, 1);
  assert.equal(graded.passed, false);
});

test("gradeQuizAnswers normalizes answer casing", () => {
  const graded = gradeQuizAnswers(session, { q1: "a", q2: "b" });

  assert.deepEqual(graded.answers, { q1: "A", q2: "B" });
  assert.equal(graded.correctCount, 2);
  assert.equal(graded.passed, true);
});

test("gradeQuizAnswers rejects missing answers", () => {
  assert.throws(() => gradeQuizAnswers(session, { q1: "A" }), /Missing answer for question q2/);
});
