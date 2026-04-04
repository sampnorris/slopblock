import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { getSessionById } from "$lib/server/session-store.js";
import { createHmac } from "node:crypto";

function hmacAnswer(questionId: string, key: string, secret: string): string {
  return createHmac("sha256", secret).update(`${questionId}:${key}`).digest("hex").slice(0, 16);
}

function quizSecret(): string {
  return process.env.GITHUB_WEBHOOK_SECRET ?? "slopblock";
}

export const load: PageServerLoad = async ({ params, request }) => {
  const session = await getSessionById(params.token);
  if (!session) {
    error(404, "This quiz link is no longer valid.");
  }

  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);

  const prUrl = `https://github.com/${session.repositoryOwner}/${session.repositoryName}/pull/${session.pullNumber}`;
  const questions = session.quiz?.questions ?? [];

  let hashes: Record<string, string> | undefined;
  if (actor && session.quiz) {
    const secret = quizSecret();
    hashes = {};
    for (const q of questions) {
      for (const opt of q.options) {
        hashes[`${q.id}:${opt.key}`] = hmacAnswer(q.id, opt.key, secret);
      }
      hashes[`${q.id}:correct`] = hmacAnswer(q.id, q.correctOption, secret);
    }
  }

  return {
    session: {
      id: session.id,
      repositoryOwner: session.repositoryOwner,
      repositoryName: session.repositoryName,
      pullNumber: session.pullNumber,
      status: session.status,
      questionCount: session.questionCount,
      retryMode: session.retryMode,
      summary: session.summary,
      questions: actor ? questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        explanation: q.explanation,
        diffAnchors: q.diffAnchors,
        focus: q.focus
      })) : [],
    },
    actor: actor ? { login: actor.login } : null,
    prUrl,
    hashes: hashes ?? {}
  };
};
