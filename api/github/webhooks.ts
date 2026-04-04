import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getInstallationOctokit, verifyWebhookSignature } from "../../src/app/github-app.js";
import { logError, logInfo } from "../../src/app/log.js";
import { handlePullRequestWebhook } from "../../src/app/service.js";

async function readRawBody(req: VercelRequest): Promise<string> {
  if (typeof req.body === "string") {
    return req.body;
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body.toString("utf8");
  }

  if (req.body && typeof req.body === "object") {
    return JSON.stringify(req.body);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rawBody = await readRawBody(req);
  if (!verifyWebhookSignature(rawBody, req.headers["x-hub-signature-256"] as string | undefined)) {
    logInfo("webhook.signature_invalid", {
      method: req.method,
      event: req.headers["x-github-event"]
    });
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const event = req.headers["x-github-event"] as string | undefined;
  const payload = JSON.parse(rawBody);
  logInfo("webhook.received", {
    event,
    action: payload.action,
    deliveryId: req.headers["x-github-delivery"],
    installationId: payload.installation?.id,
    repository: payload.repository?.full_name,
    pullNumber: payload.pull_request?.number ?? payload.issue?.number
  });
  if (event === "ping") {
    logInfo("webhook.ping", { deliveryId: req.headers["x-github-delivery"] });
    res.status(200).json({ ok: true });
    return;
  }

  if (!payload.installation?.id) {
    logInfo("webhook.ignored_no_installation", {
      event,
      action: payload.action,
      deliveryId: req.headers["x-github-delivery"]
    });
    res.status(202).json({ ignored: true, reason: "No installation context" });
    return;
  }

  try {
    logInfo("webhook.auth_installation.start", {
      installationId: payload.installation.id,
      deliveryId: req.headers["x-github-delivery"]
    });
    const octokit = await getInstallationOctokit(payload.installation.id);
    logInfo("webhook.auth_installation.complete", {
      installationId: payload.installation.id,
      deliveryId: req.headers["x-github-delivery"]
    });

    if (event === "pull_request") {
      await handlePullRequestWebhook(octokit, payload);
    } else {
      logInfo("webhook.ignored_event", {
        event,
        action: payload.action,
        deliveryId: req.headers["x-github-delivery"]
      });
    }
    logInfo("webhook.completed", {
      event,
      action: payload.action,
      deliveryId: req.headers["x-github-delivery"]
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    logError("webhook.failed", error, {
      event,
      action: payload.action,
      deliveryId: req.headers["x-github-delivery"],
      installationId: payload.installation?.id,
      repository: payload.repository?.full_name,
      pullNumber: payload.pull_request?.number ?? payload.issue?.number
    });
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
