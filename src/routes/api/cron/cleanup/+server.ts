import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { deleteStaleSessions } from "$lib/server/session-store.js";
import { logInfo, logError } from "$lib/server/log.js";

const STALE_DAYS = 30;

export const GET: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await deleteStaleSessions(STALE_DAYS);
    logInfo("cron.cleanup.complete", { deletedSessions: deleted, staleDays: STALE_DAYS });
    return json({ ok: true, deleted, staleDays: STALE_DAYS });
  } catch (error) {
    logError("cron.cleanup.failed", error, {});
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
};
