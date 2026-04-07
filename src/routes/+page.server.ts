import type { PageServerLoad } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";

export const load: PageServerLoad = async ({ request }) => {
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);

  return {
    isLoggedIn: !!actor,
  };
};
