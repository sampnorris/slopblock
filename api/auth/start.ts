import type { VercelRequest, VercelResponse } from "@vercel/node";
import { githubAuthorizeUrl } from "../../src/app/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sessionId = typeof req.query.session === "string" ? req.query.session : undefined;
  if (!sessionId) {
    res.status(400).send("Missing session id");
    return;
  }

  res.redirect(githubAuthorizeUrl(sessionId));
}
