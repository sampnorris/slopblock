import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { devMocksEnabled, mockSession } from "$lib/server/dev-mocks.js";
import { getInstallationOctokit } from "$lib/server/github-app.js";
import { getSessionById, saveSessionAnswers } from "$lib/server/session-store.js";
import { markQuizPassed, requestNewQuiz } from "$lib/server/service.js";

async function getLatestPullHeadSha(octokit: any, session: { repositoryOwner: string; repositoryName: string; pullNumber: number; }) {
  const { data: pull } = await octokit.rest.pulls.get({
    owner: session.repositoryOwner,
    repo: session.repositoryName,
    pull_number: session.pullNumber,
  });
  return pull.head.sha;
}

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

      return json(
        {
          ok: wrongCount <= allowedWrongAnswers,
          passed: wrongCount <= allowedWrongAnswers,
          correctCount,
          questionCount: session.questionCount,
          attemptNumber: 1,
          message:
            wrongCount <= allowedWrongAnswers
              ? "Mock quiz passed."
              : `Quiz not passed (${correctCount}/${session.questionCount} correct). Fix your answers or generate a new quiz.`,
        },
        wrongCount <= allowedWrongAnswers ? {} : { status: 400 },
      );
    }

    if (action === "save_answers") {
      return json({ ok: true });
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

  // save_answers doesn't need octokit — handle it before the GitHub API call
  if (action === "save_answers") {
    const expectedHeadSha = typeof body?.expectedHeadSha === "string" ? body.expectedHeadSha.trim() : "";
    if (!expectedHeadSha || expectedHeadSha !== session.headSha) {
      return json(
        {
          ok: false,
          drifted: true,
          message: "Quiz version changed. Reload to continue with the latest quiz.",
        },
        { status: 409 },
      );
    }

    const answers = body?.answers;
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return json({ ok: false, message: "Answers object is required." }, { status: 400 });
    }

    const validQuestionIds = new Set((session.quiz?.questions ?? []).map((question) => question.id));
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(answers)) {
      if (validQuestionIds.has(key) && typeof value === "string" && value.trim()) {
        cleaned[key] = value.trim().toUpperCase();
      }
    }
    await saveSessionAnswers(session.id!, cleaned);
    return json({ ok: true });
  }

  const octokit = await getInstallationOctokit(session.installationId);

  if (action === "pass") {
    try {
      const expectedHeadSha = typeof body?.expectedHeadSha === "string" ? body.expectedHeadSha.trim() : "";
      if (!expectedHeadSha) {
        return json({ ok: false, message: "Quiz version is required. Reload and try again." }, { status: 400 });
      }

      if (expectedHeadSha !== session.headSha) {
        return json(
          {
            ok: false,
            drifted: true,
            message:
              "Your quiz version is stale. Reload the page to continue with the latest quiz.",
          },
          { status: 409 },
        );
      }

      const latestHeadSha = await getLatestPullHeadSha(octokit, session);
      if (latestHeadSha !== session.headSha) {
        await requestNewQuiz({
          octokit,
          session: {
            ...session,
            headSha: latestHeadSha,
          },
        });
        return json(
          {
            ok: false,
            drifted: true,
            message:
              "Your quiz is out of date because new commits were pushed. A fresh quiz was generated for the latest PR changes. Reload and answer the new quiz.",
          },
          { status: 409 },
        );
      }

      const answers = body?.answers;
      if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
        return json({ ok: false, message: "Answers are required." }, { status: 400 });
      }

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
