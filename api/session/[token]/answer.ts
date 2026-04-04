import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSessionActor } from "../../../src/app/auth.js";
import { getInstallationOctokit } from "../../../src/app/github-app.js";
import { getSessionById } from "../../../src/app/session-store.js";
import { markQuizPassed, requestNewQuiz } from "../../../src/app/service.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, message: "Method not allowed." });
    return;
  }

  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  const actor = getSessionActor(req);
  if (!token || !actor) {
    res.status(400).json({ ok: false, message: "Missing session or login." });
    return;
  }

  const session = await getSessionById(token);
  if (!session) {
    res.status(404).json({ ok: false, message: "Session not found." });
    return;
  }

  if (actor.login !== session.authorLogin) {
    res.status(403).json({ ok: false, message: "Only the PR author can interact with this quiz." });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const action = body?.action;

  const octokit = await getInstallationOctokit(session.installationId);

  if (action === "pass") {
    const result = await markQuizPassed({ octokit, session });
    res.json(result);
    return;
  }

  if (action === "retry_new") {
    const result = await requestNewQuiz({ octokit, session });
    res.json(result);
    return;
  }

  res.status(400).json({ ok: false, message: "Unknown action." });
}
