import test from "node:test";
import assert from "node:assert/strict";
import { SessionStatus } from "@prisma/client";
import { renderSessionComment } from "../src/lib/server/render.js";
import { sessionAnswerUrl } from "../src/lib/server/github-service.js";
import type { SessionRecord } from "../src/lib/server/session-store.js";

const baseSession: SessionRecord = {
  id: "session-123",
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

test("renderSessionComment links to the quiz UI", () => {
  const originalAppBaseUrl = process.env.APP_BASE_URL;
  process.env.APP_BASE_URL = "https://slopblock.example.com";

  try {
    const output = renderSessionComment(baseSession);
    assert.match(output, /waiting for PR author/);
    assert.match(output, /Questions:\*\* 2/);
    assert.match(output, /Take the quiz/);
    assert.match(output, /https:\/\/slopblock\.example\.com\/session\//);
  } finally {
    if (originalAppBaseUrl === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = originalAppBaseUrl;
    }
  }
});

test("sessionAnswerUrl falls back to Vercel deployment URL", () => {
  const originalAppBaseUrl = process.env.APP_BASE_URL;
  const originalVercelProjectProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const originalVercelUrl = process.env.VERCEL_URL;
  delete process.env.APP_BASE_URL;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "slopblock.vercel.app";
  delete process.env.VERCEL_URL;

  try {
    assert.equal(sessionAnswerUrl({ ...baseSession, id: "session-123" }), "https://slopblock.vercel.app/session/session-123");
  } finally {
    if (originalAppBaseUrl === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = originalAppBaseUrl;
    }
    if (originalVercelProjectProductionUrl === undefined) {
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    } else {
      process.env.VERCEL_PROJECT_PRODUCTION_URL = originalVercelProjectProductionUrl;
    }
    if (originalVercelUrl === undefined) {
      delete process.env.VERCEL_URL;
    } else {
      process.env.VERCEL_URL = originalVercelUrl;
    }
  }
});

test("renderSessionComment shows passed state", () => {
  const output = renderSessionComment({
    ...baseSession,
    status: SessionStatus.passed
  });
  assert.match(output, /passed/);
  assert.match(output, /abcdef1/);
});

test("renderSessionComment shows skipped state", () => {
  const output = renderSessionComment({
    ...baseSession,
    status: SessionStatus.skipped,
    skipReason: "Docs-only change."
  });
  assert.match(output, /skipped/);
  assert.match(output, /Docs-only change/);
});
