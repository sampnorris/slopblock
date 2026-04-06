import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { devMocksEnabled, mockActor, mockActivityData } from "$lib/server/dev-mocks.js";
import { listSessionsByInstallation, getSessionStats } from "$lib/server/session-store.js";
import { getAttemptStats } from "$lib/server/attempt-store.js";

export const load: PageServerLoad = async ({ params, request, url }) => {
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);

  if (devMocksEnabled()) {
    const mock = mockActivityData();
    return {
      installationId: params.installationId,
      actor: mockActor(),
      sessions: mock.sessions,
      sessionStats: mock.sessionStats,
      attemptStats: mock.attemptStats
    };
  }

  if (!actor) {
    redirect(302, `/auth/start?session=settings-${params.installationId}&return=${encodeURIComponent(url.pathname)}`);
  }

  const [sessions, sessionStats, attemptStats] = await Promise.all([
    listSessionsByInstallation(params.installationId),
    getSessionStats(params.installationId),
    getAttemptStats(params.installationId)
  ]);

  return {
    installationId: params.installationId,
    actor: { login: actor.login },
    sessions,
    sessionStats,
    attemptStats
  };
};
