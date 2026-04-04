import type { VercelRequest, VercelResponse } from "@vercel/node";
import { exchangeCodeForLogin, readOAuthState, setSessionActor } from "../../src/app/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const parsed = readOAuthState(state);

  if (!code || !parsed?.sessionId) {
    res.status(400).send("Invalid OAuth callback");
    return;
  }

  const login = await exchangeCodeForLogin(code);
  setSessionActor(res, login);
  res.redirect(`/session/${parsed.sessionId}`);
}
