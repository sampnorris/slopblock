import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSessionActor } from "../../../src/app/auth.js";
import { getInstallationOctokit } from "../../../src/app/github-app.js";
import { getSessionById } from "../../../src/app/session-store.js";
import { submitAnswer } from "../../../src/app/service.js";
import { renderErrorPage } from "../../../src/app/ui.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).send(renderErrorPage("Method not allowed", "Use the answer buttons to submit a choice."));
    return;
  }

  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  const actor = getSessionActor(req);
  const answer = typeof req.body?.answer === "string" ? req.body.answer : typeof req.query.answer === "string" ? req.query.answer : undefined;
  if (!token || !actor || !answer) {
    res.status(400).send(renderErrorPage("Invalid answer", "Missing session, login, or answer value."));
    return;
  }

  const session = await getSessionById(token);
  if (!session) {
    res.status(404).send(renderErrorPage("Session not found", "This quiz link is no longer valid."));
    return;
  }

  const octokit = await getInstallationOctokit(session.installationId);
  const result = await submitAnswer({
    octokit,
    sessionId: token,
    actorLogin: actor.login,
    selectedKey: answer
  });

  if (result.redirectUrl.startsWith("http")) {
    res.redirect(result.redirectUrl);
    return;
  }

  res.redirect(`/session/${token}`);
}
