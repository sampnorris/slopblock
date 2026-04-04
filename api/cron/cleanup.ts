import type { VercelRequest, VercelResponse } from "@vercel/node";
import { deleteStaleSessions } from "../../src/app/session-store.js";
import { logInfo, logError } from "../../src/app/log.js";

const STALE_DAYS = 30;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const deleted = await deleteStaleSessions(STALE_DAYS);
    logInfo("cron.cleanup.complete", { deletedSessions: deleted, staleDays: STALE_DAYS });
    res.json({ ok: true, deleted, staleDays: STALE_DAYS });
  } catch (error) {
    logError("cron.cleanup.failed", error, {});
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
