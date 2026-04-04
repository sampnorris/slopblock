import test from "node:test";
import assert from "node:assert/strict";
import { SessionStatus } from "@prisma/client";
import { renderSessionComment } from "../src/app/render.js";
import type { SessionRecord } from "../src/app/session-store.js";

const baseSession: SessionRecord = {
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
  summary: "This PR changes the admin flow.",
  quiz: {
    summary: "This PR changes the admin flow.",
    questions: [
      {
        id: "q1",
        prompt: "What changed?",
        options: [
          { key: "A", text: "Option A" },
          { key: "B", text: "Option B" },
          { key: "C", text: "Option C" },
          { key: "D", text: "Option D" }
        ],
        correctOption: "A",
        explanation: "Because.",
        diffAnchors: ["src/a.ts"],
        focus: "behavior"
      },
      {
        id: "q2",
        prompt: "What next?",
        options: [
          { key: "A", text: "Another A" },
          { key: "B", text: "Another B" },
          { key: "C", text: "Another C" }
        ],
        correctOption: "B",
        explanation: "Because.",
        diffAnchors: [],
        focus: "risk"
      }
    ]
  }
};

test("renderSessionComment links to the external answer UI", () => {
  const output = renderSessionComment(baseSession);
  assert.match(output, /Question 1 of 2/);
  assert.match(output, /A\. Option A/);
  assert.match(output, /B\. Option B/);
  assert.match(output, /\[Answer Question\]\(/);
  assert.doesNotMatch(output, /Question 2 of 2/);
});

test("renderSessionComment shows passed state", () => {
  const output = renderSessionComment({
    ...baseSession,
    status: SessionStatus.passed
  });
  assert.match(output, /Status: passed/);
});
