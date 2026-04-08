import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { devMocksEnabled, mockActivityData } from "$lib/server/dev-mocks.js";
import { listSessionsByInstallation, getSessionStats } from "$lib/server/session-store.js";
import { getAttemptStats } from "$lib/server/attempt-store.js";
import { getSessionActor } from "$lib/server/auth.js";
import { verifyInstallationAccess } from "$lib/server/installation-auth.js";

export const load: PageServerLoad = async ({ params, request }) => {
  if (devMocksEnabled()) {
    const mock = mockActivityData();
    return {
      installationId: params.installationId,
      sessions: mock.sessions,
      sessionStats: mock.sessionStats,
      attemptStats: mock.attemptStats,
    };
  }

  // Auth is handled by the parent layout, but we also verify installation access
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);
  if (actor) {
    const hasAccess = await verifyInstallationAccess(params.installationId, actor.login);
    if (!hasAccess) {
      error(403, "You do not have access to this installation.");
    }
  }

  const [sessions, sessionStats, attemptStats] = await Promise.all([
    listSessionsByInstallation(params.installationId),
    getSessionStats(params.installationId),
    getAttemptStats(params.installationId),
  ]);

  return {
    installationId: params.installationId,
    sessions,
    sessionStats,
    attemptStats,
  };
};
