import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { exchangeCodeForLogin, readOAuthState, buildSessionCookie } from "$lib/server/auth.js";

export const GET: RequestHandler = async ({ url }) => {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const parsed = readOAuthState(state ?? undefined);

  if (!code || !parsed?.sessionId) {
    return new Response("Invalid OAuth callback", { status: 400 });
  }

  const login = await exchangeCodeForLogin(code);
  const cookie = buildSessionCookie(login);

  return new Response(null, {
    status: 302,
    headers: {
      location: `/session/${parsed.sessionId}`,
      "set-cookie": cookie
    }
  });
};
