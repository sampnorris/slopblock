import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { verifyMarketplaceWebhookSignature } from "$lib/server/github-app.js";
import { processMarketplaceWebhook } from "$lib/server/github-marketplace.js";
import { logError, logInfo } from "$lib/server/log.js";

export const POST: RequestHandler = async ({ request }) => {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? undefined;

  if (!verifyMarketplaceWebhookSignature(rawBody, signature)) {
    logInfo("marketplace_webhook.signature_invalid", {});
    return json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = payload.action ?? "";
  const accountLogin = payload.marketplace_purchase?.account?.login?.trim();

  try {
    const result = await processMarketplaceWebhook(payload);
    return json(result, { status: result.status });
  } catch (error) {
    logError("marketplace_webhook.failed", error, {
      action,
      accountLogin,
    });
    return json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
};
