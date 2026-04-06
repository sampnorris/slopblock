import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { devMocksEnabled, mockActor, mockSession } from "$lib/server/dev-mocks.js";
import { getSessionById } from "$lib/server/session-store.js";

export const load: PageServerLoad = async ({ params, request }) => {
  const session = devMocksEnabled() ? mockSession(params.token) : await getSessionById(params.token);
  if (!session) {
    error(404, "This quiz link is no longer valid.");
  }

  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = devMocksEnabled() ? mockActor() : getSessionActor({ headers: { cookie: cookieHeader } } as any);

  const prUrl = `https://github.com/${session.repositoryOwner}/${session.repositoryName}/pull/${session.pullNumber}`;
  const questions = session.quiz?.questions ?? [];

  return {
    session: {
      id: session.id,
      repositoryOwner: session.repositoryOwner,
      repositoryName: session.repositoryName,
      pullNumber: session.pullNumber,
      status: session.status,
      questionCount: session.questionCount,
      retryMode: session.retryMode,
      generationModel: session.generationModel,
      validationModel: session.validationModel,
      summary: session.summary,
      traceId: session.traceId,
      questions: actor ? questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        correctOption: q.correctOption,
        explanation: q.explanation,
        diffAnchors: q.diffAnchors,
        focus: q.focus
      })) : [],
    },
    actor: actor ? { login: actor.login } : null,
    prUrl
  };
};
