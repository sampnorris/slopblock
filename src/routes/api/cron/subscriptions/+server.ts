import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { runSubscriptionsCron } from "$lib/server/subscriptions-cron.js";
import { logError, logInfo } from "$lib/server/log.js";

export const GET: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSubscriptionsCron();
    logInfo("cron.subscriptions.complete", { reconciled: result.reconciled });
    return json(result);
  } catch (error) {
    logError("cron.subscriptions.failed", error, {});
    return json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
};
