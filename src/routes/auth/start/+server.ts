import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { githubAuthorizeUrl } from "$lib/server/auth.js";

export const GET: RequestHandler = async ({ url }) => {
  const sessionId = url.searchParams.get("session");
  if (!sessionId) {
    return new Response("Missing session id", { status: 400 });
  }

  redirect(302, githubAuthorizeUrl(sessionId));
};
