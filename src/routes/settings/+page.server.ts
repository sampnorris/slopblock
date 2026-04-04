import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { getGitHubApp } from "$lib/server/github-app.js";

interface Installation {
  id: number;
  account: { login: string; avatar_url: string; type: string };
}

export const load: PageServerLoad = async ({ request, url }) => {
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);

  if (!actor) {
    redirect(302, `/auth/start?session=settings&return=${encodeURIComponent(url.pathname)}`);
  }

  const app = getGitHubApp();
  const installations: Installation[] = [];

  try {
    const iter = app.eachInstallation.iterator();
    for await (const { installation } of iter) {
      installations.push({
        id: installation.id,
        account: {
          login: (installation.account as any)?.login ?? "unknown",
          avatar_url: (installation.account as any)?.avatar_url ?? "",
          type: (installation.account as any)?.type ?? "User"
        }
      });
    }
  } catch {
    // If we can't list installations, show empty state
  }

  return {
    actor: { login: actor.login },
    installations
  };
};
