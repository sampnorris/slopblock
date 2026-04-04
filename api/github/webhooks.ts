import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getInstallationOctokit, verifyWebhookSignature } from "../../src/app/github-app.js";
import { handlePullRequestWebhook, handleReactionWebhook } from "../../src/app/service.js";

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
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const event = req.headers["x-github-event"] as string | undefined;
  const payload = JSON.parse(rawBody);
  if (event === "ping") {
    res.status(200).json({ ok: true });
    return;
  }

  if (!payload.installation?.id) {
    res.status(202).json({ ignored: true, reason: "No installation context" });
    return;
  }

  const octokit = await getInstallationOctokit(payload.installation.id);

  try {
    if (event === "pull_request") {
      await handlePullRequestWebhook(octokit, payload);
    } else if (event === "reaction") {
      await handleReactionWebhook(octokit, payload);
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
