import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { devMocksEnabled, mockActivityData } from "$lib/server/dev-mocks.js";
import { getInstallationOctokit } from "$lib/server/github-app.js";
import { listSessionsByInstallation, getSessionStats } from "$lib/server/session-store.js";
import { getAttemptStats } from "$lib/server/attempt-store.js";
import { getSessionActor } from "$lib/server/auth.js";
import { verifyInstallationAccess } from "$lib/server/installation-auth.js";

async function getLatestPullHeadSha(
  octokit: any,
  session: { repositoryOwner: string; repositoryName: string; pullNumber: number },
) {
  const { data: pull } = await octokit.rest.pulls.get({
    owner: session.repositoryOwner,
    repo: session.repositoryName,
    pull_number: session.pullNumber,
  });
  return pull.head.sha;
}

async function addRegeneratingState(installationId: string, sessions: any[]) {
  const octokit = await getInstallationOctokit(Number(installationId));
  let regenerating = 0;

  const enriched = await Promise.all(
    sessions.map(async (session) => {
      if (session.status !== "awaiting_answer") {
        return { ...session, isRegenerating: false };
      }

      try {
        const latestHeadSha = await getLatestPullHeadSha(octokit, session);
        const isRegenerating = latestHeadSha !== session.headSha;
        if (isRegenerating) regenerating += 1;
        return { ...session, isRegenerating };
      } catch {
        return { ...session, isRegenerating: false };
      }
    }),
  );

  return { sessions: enriched, regenerating };
}

export const load: PageServerLoad = async ({ params, request, url, cookies }) => {
  if (devMocksEnabled()) {
    const mock = mockActivityData();
    return {
      installationId: params.installationId,
      sessions: mock.sessions,
      sessionStats: mock.sessionStats,
      attemptStats: mock.attemptStats,
    };
  }

  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);
  if (actor) {
    const access = await verifyInstallationAccess(
      params.installationId,
      actor.login,
      actor.token,
    );
    if (access === "not_found") {
      redirect(302, "/settings");
    }
    if (access === "denied") {
      if (!url.searchParams.has("reauthed")) {
        cookies.delete("slopblock_session", { path: "/" });
        redirect(
          302,
          `/auth/start?session=settings&return=${encodeURIComponent(`${url.pathname}?reauthed=1`)}`,
        );
      }
      error(403, "You do not have access to this installation.");
    }
  }

  const [sessions, sessionStats, attemptStats] = await Promise.all([
    listSessionsByInstallation(params.installationId),
    getSessionStats(params.installationId),
    getAttemptStats(params.installationId),
  ]);
  const liveSessions = await addRegeneratingState(params.installationId, sessions);

  return {
    installationId: params.installationId,
    sessions: liveSessions.sessions,
    sessionStats: {
      ...sessionStats,
      awaiting: Math.max(0, sessionStats.awaiting - liveSessions.regenerating),
      regenerating: liveSessions.regenerating,
    },
    attemptStats,
  };
};
