import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSessionActor } from "../../src/app/auth.js";
import { renderErrorPage, renderLoginPage, renderQuizPage } from "../../src/app/ui.js";
import { getSessionById } from "../../src/app/session-store.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  if (!token) {
    res.status(400).send(renderErrorPage("Invalid session", "Missing quiz session token."));
    return;
  }

  const session = await getSessionById(token);
  if (!session) {
    res.status(404).send(renderErrorPage("Session not found", "This quiz link is no longer valid."));
    return;
  }

  const actor = getSessionActor(req);
  res.setHeader("content-type", "text/html; charset=utf-8");

  if (!actor) {
    res.status(200).send(renderLoginPage(session));
    return;
  }

  res.status(200).send(renderQuizPage(session, actor.login));
}
