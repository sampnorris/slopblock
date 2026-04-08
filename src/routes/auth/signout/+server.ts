import type { RequestHandler } from "./$types";

const SESSION_COOKIE = "slopblock_session";

export const POST: RequestHandler = async () => {
  return new Response(null, {
    status: 302,
    headers: {
      location: "/",
      "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
};
