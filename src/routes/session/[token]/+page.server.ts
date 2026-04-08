import { createHash } from "node:crypto";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { devMocksEnabled, mockActor, mockSession } from "$lib/server/dev-mocks.js";
import { getInstallationOctokit } from "$lib/server/github-app.js";
import { getSessionById } from "$lib/server/session-store.js";

async function getLatestPullHeadSha(
  installationId: number,
  session: { repositoryOwner: string; repositoryName: string; pullNumber: number },
) {
  const octokit = await getInstallationOctokit(installationId);
  const { data: pull } = await octokit.rest.pulls.get({
    owner: session.repositoryOwner,
    repo: session.repositoryName,
    pull_number: session.pullNumber,
  });
  return pull.head.sha;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export const load: PageServerLoad = async ({ params, request }) => {
  const session = devMocksEnabled()
    ? mockSession(params.token)
    : await getSessionById(params.token);
  if (!session) {
    error(404, "This quiz link is no longer valid.");
  }

  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = devMocksEnabled()
    ? mockActor()
    : getSessionActor({ headers: { cookie: cookieHeader } } as any);

  const prUrl = `https://github.com/${session.repositoryOwner}/${session.repositoryName}/pull/${session.pullNumber}`;
  const questions = session.quiz?.questions ?? [];
  let staleQuiz: { open: boolean; message: string } | null = null;

  if (devMocksEnabled() && session.isRegenerating) {
    staleQuiz = {
      open: true,
      message:
        "This quiz is being replaced because newer PR commits were detected. Load the latest quiz before continuing.",
    };
  } else if (!devMocksEnabled() && session.status !== "passed" && session.status !== "skipped") {
    try {
      const latestHeadSha = await getLatestPullHeadSha(session.installationId, session);
      if (latestHeadSha !== session.headSha) {
        staleQuiz = {
          open: true,
          message:
            "This quiz is being replaced because newer PR commits were detected. Load the latest quiz before continuing.",
        };
      }
    } catch {
      // Fall back to the stored session when GitHub is temporarily unavailable.
    }
  }

  // Pre-compute SHA-256 hashes for diff anchor file paths (GitHub uses #diff-{sha256} format)
  const diffAnchorHashes: Record<string, string> = {};
  for (const q of questions) {
    for (const anchor of q.diffAnchors ?? []) {
      const clean = anchor.replace(/^[+\-~]\s*/, "").split(/[:#]/)[0];
      if (clean && !diffAnchorHashes[clean]) {
        diffAnchorHashes[clean] = sha256Hex(clean);
      }
    }
  }

  return {
    session: {
      id: session.id,
      headSha: session.headSha,
      repositoryOwner: session.repositoryOwner,
      repositoryName: session.repositoryName,
      pullNumber: session.pullNumber,
      status: session.status,
      questionCount: session.questionCount,
      retryMode: session.retryMode,
      allowedWrongAnswers: session.allowedWrongAnswers ?? 0,
      generationModel: session.generationModel,
      validationModel: session.validationModel,
      summary: session.summary,
      traceId: session.traceId,
      questions: actor
        ? questions.map((q) => ({
            id: q.id,
            prompt: q.prompt,
            options: q.options,
            correctOption: q.correctOption,
            explanation: q.explanation,
            diffAnchors: q.diffAnchors,
            focus: q.focus,
          }))
        : [],
      savedAnswers: actor ? (session.savedAnswers ?? null) : null,
    },
    actor: actor ? { login: actor.login } : null,
    prUrl,
    diffAnchorHashes,
    staleQuiz,
  };
};
