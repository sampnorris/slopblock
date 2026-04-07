import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { devMocksEnabled, mockSession } from "$lib/server/dev-mocks.js";
import { getInstallationOctokit } from "$lib/server/github-app.js";
import { getSessionById } from "$lib/server/session-store.js";
import { markQuizPassed, requestNewQuiz } from "$lib/server/service.js";

export const POST: RequestHandler = async ({ params, request }) => {
  if (devMocksEnabled()) {
    const body = await request.json();
    const action = body?.action;
    const session = mockSession(params.token);

    if (action === "pass") {
      const answers = body?.answers;
      const correctCount = Object.entries(answers ?? {}).reduce((count, [questionId, answer]) => {
        const question = session.quiz?.questions.find((item) => item.id === questionId);
        return (
          count +
          (question && typeof answer === "string" && answer.toUpperCase() === question.correctOption
            ? 1
            : 0)
        );
      }, 0);
      const allowedWrongAnswers = Math.max(0, session.allowedWrongAnswers ?? 0);
      const wrongCount = Math.max(0, session.questionCount - correctCount);

      return json({
        ok: true,
        passed: wrongCount <= allowedWrongAnswers,
        correctCount,
        questionCount: session.questionCount,
        attemptNumber: 1,
        message: wrongCount <= allowedWrongAnswers ? "Mock quiz passed." : undefined,
      });
    }

    if (action === "retry_new") {
      return json({ ok: true, message: "Mock new quiz generated." });
    }

    return json({ ok: false, message: "Unknown action." }, { status: 400 });
  }

  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);

  if (!actor) {
    return json({ ok: false, message: "Not authenticated." }, { status: 401 });
  }

  const session = await getSessionById(params.token);
  if (!session) {
    return json({ ok: false, message: "Session not found." }, { status: 404 });
  }

  if (actor.login !== session.authorLogin) {
    return json(
      { ok: false, message: "Only the PR author can interact with this quiz." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const action = body?.action;
  const octokit = await getInstallationOctokit(session.installationId);

  if (action === "pass") {
    const answers = body?.answers;
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return json({ ok: false, message: "Answers are required." }, { status: 400 });
    }

    try {
      const result = await markQuizPassed({ octokit, session, answers });
      return json(result);
    } catch (error) {
      return json(
        { ok: false, message: error instanceof Error ? error.message : "Failed to grade quiz." },
        { status: 400 },
      );
    }
  }

  if (action === "retry_new") {
    const result = await requestNewQuiz({ octokit, session });
    return json(result);
  }

  return json({ ok: false, message: "Unknown action." }, { status: 400 });
};
