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
          { key: "B", text: "B" },
        ],
        correctOption: "A",
        explanation: "because",
        diffAnchors: [],
        focus: "behavior",
      },
      {
        id: "q2",
        prompt: "Two?",
        options: [
          { key: "A", text: "A" },
          { key: "B", text: "B" },
        ],
        correctOption: "B",
        explanation: "because",
        diffAnchors: [],
        focus: "risk",
      },
    ],
  },
};

test("normalizeQuizPayload converts string options into keyed options", () => {
  const quiz = normalizeQuizPayload({
    summary: "summary",
    questions: [
      {
        prompt: "What changed?",
        options: ["first", "second", "third"],
        correctOption: "second",
        explanation: "because",
        diffAnchors: ["src/file.ts"],
      },
    ],
  });

  assert.equal(quiz.questions.length, 1);
  // After shuffling, keys are always A, B, C in order
  assert.deepEqual(
    quiz.questions[0].options.map((option) => option.key),
    ["A", "B", "C"],
  );
  // The correct option key should point to the option with text "second"
  const correctKey = quiz.questions[0].correctOption;
  const correctOption = quiz.questions[0].options.find((o) => o.key === correctKey);
  assert.equal(correctOption?.text, "second");
  // All three texts should still be present
  const texts = new Set(quiz.questions[0].options.map((o) => o.text));
  assert.ok(texts.has("first"));
  assert.ok(texts.has("second"));
  assert.ok(texts.has("third"));
});

test("normalizeQuizPayload shuffles options and correctOption tracks correctly", () => {
  // Run normalization many times; if shuffling is working, the correct option
  // should not always land on the same key.
  const correctKeys = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const quiz = normalizeQuizPayload({
      summary: "summary",
      questions: [
        {
          prompt: "What changed?",
          options: [
            { key: "A", text: "alpha" },
            { key: "B", text: "beta" },
            { key: "C", text: "gamma" },
          ],
          correctOption: "A",
          explanation: "because",
          diffAnchors: ["src/file.ts"],
        },
      ],
    });

    const q = quiz.questions[0];
    // correctOption must always point to the "alpha" text regardless of position
    const correctOption = q.options.find((o) => o.key === q.correctOption);
    assert.equal(correctOption?.text, "alpha", "correctOption must track the correct text");

    // Keys are always A, B, C in order
    assert.deepEqual(
      q.options.map((o) => o.key),
      ["A", "B", "C"],
    );

    correctKeys.add(q.correctOption);
  }

  // With 50 runs and 3 positions, it's astronomically unlikely all land on the same key
  assert.ok(
    correctKeys.size > 1,
    `Expected correct answer to appear in multiple positions, but only saw: ${[...correctKeys].join(", ")}`,
  );
});

test("validateQuizPayload rejects questions with more than 3 options", () => {
  const issues = validateQuizPayload({
    summary: "summary",
    questions: [
      {
        id: "q1",
        prompt: "What changed?",
        options: [
          { key: "A", text: "first" },
          { key: "B", text: "second" },
          { key: "C", text: "third" },
          { key: "D", text: "fourth" },
        ],
        correctOption: "A",
        explanation: "because",
        diffAnchors: [],
        focus: "behavior",
      },
    ],
  });

  assert.ok(issues.some((issue) => issue.includes("exactly 3 options")));
});

test("validateQuizPayload rejects the wrong question count", () => {
  const issues = validateQuizPayload(
    {
      summary: "summary",
      questions: [
        {
          id: "q1",
          prompt: "What changed?",
          options: [
            { key: "A", text: "first" },
            { key: "B", text: "second" },
            { key: "C", text: "third" },
          ],
          correctOption: "A",
          explanation: "because",
          diffAnchors: [],
          focus: "behavior",
        },
      ],
    },
    2,
  );

  assert.ok(issues.some((issue) => issue.includes("exactly 2 questions")));
});

test("validateQuizPayload rejects empty or malformed questions", () => {
  const issues = validateQuizPayload({
    summary: "summary",
    questions: [],
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
