import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getInstallationOctokit, verifyWebhookSignature } from "$lib/server/github-app.js";
import { logError, logInfo } from "$lib/server/log.js";
import { handlePullRequestWebhook, handlePullRequestClosed } from "$lib/server/service.js";

export const POST: RequestHandler = async ({ request }) => {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? undefined;

  if (!verifyWebhookSignature(rawBody, signature)) {
    logInfo("webhook.signature_invalid", {
      event: request.headers.get("x-github-event")
    });
    return json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event") ?? undefined;
  const payload = JSON.parse(rawBody);
  const deliveryId = request.headers.get("x-github-delivery");

  logInfo("webhook.received", {
    event,
    action: payload.action,
    deliveryId,
    installationId: payload.installation?.id,
    repository: payload.repository?.full_name,
    pullNumber: payload.pull_request?.number ?? payload.issue?.number
  });

  if (event === "ping") {
    logInfo("webhook.ping", { deliveryId });
    return json({ ok: true });
  }

  if (!payload.installation?.id) {
    logInfo("webhook.ignored_no_installation", { event, action: payload.action, deliveryId });
    return json({ ignored: true, reason: "No installation context" }, { status: 202 });
  }

  try {
    logInfo("webhook.auth_installation.start", { installationId: payload.installation.id, deliveryId });
    const octokit = await getInstallationOctokit(payload.installation.id);
    logInfo("webhook.auth_installation.complete", { installationId: payload.installation.id, deliveryId });

    if (event === "pull_request" && payload.action === "closed") {
      await handlePullRequestClosed(payload);
    } else if (event === "pull_request") {
      await handlePullRequestWebhook(octokit, payload);
    } else {
      logInfo("webhook.ignored_event", { event, action: payload.action, deliveryId });
    }

    logInfo("webhook.completed", { event, action: payload.action, deliveryId });
    return json({ ok: true });
  } catch (error) {
    logError("webhook.failed", error, {
      event,
      action: payload.action,
      deliveryId,
      installationId: payload.installation?.id,
      repository: payload.repository?.full_name,
      pullNumber: payload.pull_request?.number ?? payload.issue?.number
    });
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
};
