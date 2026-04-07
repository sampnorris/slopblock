export interface DemoQuestionOption {
  key: string;
  text: string;
}

export interface DemoQuestion {
  id: string;
  prompt: string;
  options: DemoQuestionOption[];
  correctOption: string;
  explanation: string;
  diffAnchors: string[];
}

export const publicDemoQuiz = {
  title: "PR #184: Make quiz submission reject missing answers",
  repo: "sampnorris/slopblock-quiz",
  repoUrl: "https://github.com/sampnorris/slopblock-quiz",
  installUrl: "https://github.com/apps/slopblock-quiz/installations/new",
  summary:
    "This public demo is based on a realistic server-side change: the answer endpoint now validates the submitted answer map and returns a 400 when a question is missing instead of silently accepting incomplete submissions.",
  diff: [
    "diff --git a/src/routes/api/session/[token]/answer/+server.ts b/src/routes/api/session/[token]/answer/+server.ts",
    "@@ -42,7 +42,18 @@",
    ' if (action === "pass") {',
    "-    const result = await markQuizPassed({ octokit, session });",
    "-    return json(result);",
    "+    const answers = body?.answers;",
    '+    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {',
    '+      return json({ ok: false, message: "Answers are required." }, { status: 400 });',
    "+    }",
    "+",
    "+    try {",
    "+      const result = await markQuizPassed({ octokit, session, answers });",
    "+      return json(result);",
    "+    } catch (error) {",
    '+      return json({ ok: false, message: error instanceof Error ? error.message : "Failed to grade quiz." }, { status: 400 });',
    "+    }",
    " }",
  ],
  questions: [
    {
      id: "q1",
      prompt: "What new request shape is required before the endpoint will grade the quiz?",
      options: [
        {
          key: "A",
          text: "A `score` number pre-calculated by the client must be included in the request body.",
        },
        {
          key: "B",
          text: "An `answers` object keyed by question ID must be present in the request body.",
        },
        {
          key: "C",
          text: "A `passed: true` flag must accompany the answers in the request body.",
        },
      ],
      correctOption: "B",
      explanation:
        "The route now rejects requests that do not include an answers object for grading.",
      diffAnchors: ["src/routes/api/session/[token]/answer/+server.ts"],
    },
    {
      id: "q2",
      prompt: "Why does the handler wrap `markQuizPassed(...)` in a try/catch?",
      options: [
        {
          key: "A",
          text: "So the handler can suppress failures and still return `ok: true` to the client.",
        },
        {
          key: "B",
          text: "So the server can retry the `markQuizPassed` call up to three times on failure.",
        },
        {
          key: "C",
          text: "So grading errors are returned as a 400 JSON response instead of crashing the request.",
        },
      ],
      correctOption: "C",
      explanation:
        "Validation and grading failures are returned as explicit client-visible errors with status 400.",
      diffAnchors: ["src/routes/api/session/[token]/answer/+server.ts"],
    },
    {
      id: "q3",
      prompt: "What behavior changed for incomplete quiz submissions after this diff?",
      options: [
        {
          key: "A",
          text: "They are rejected early with a 400 error before reaching the grading logic.",
        },
        {
          key: "B",
          text: "They are filled in with default answers by the server before grading proceeds.",
        },
        {
          key: "C",
          text: "They are accepted by the endpoint but the resulting score is capped at 50%.",
        },
      ],
      correctOption: "A",
      explanation:
        "The new guard stops incomplete payloads before grading and reports the problem clearly.",
      diffAnchors: ["src/routes/api/session/[token]/answer/+server.ts"],
    },
  ] satisfies DemoQuestion[],
};
