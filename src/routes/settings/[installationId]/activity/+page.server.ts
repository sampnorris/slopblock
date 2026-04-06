import type { PageServerLoad } from "./$types";
import { devMocksEnabled, mockActivityData } from "$lib/server/dev-mocks.js";
import { listSessionsByInstallation, getSessionStats } from "$lib/server/session-store.js";
import { getAttemptStats } from "$lib/server/attempt-store.js";

export const load: PageServerLoad = async ({ params }) => {
  if (devMocksEnabled()) {
    const mock = mockActivityData();
    return {
      installationId: params.installationId,
      sessions: mock.sessions,
      sessionStats: mock.sessionStats,
      attemptStats: mock.attemptStats
    };
  }

  // Auth is handled by the parent layout

  const [sessions, sessionStats, attemptStats] = await Promise.all([
    listSessionsByInstallation(params.installationId),
    getSessionStats(params.installationId),
    getAttemptStats(params.installationId)
  ]);

  return {
    installationId: params.installationId,
    sessions,
    sessionStats,
    attemptStats
  };
};
