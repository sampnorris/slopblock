import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { devMocksEnabled, mockActor, mockInstallations } from "$lib/server/dev-mocks.js";
import { getGitHubApp } from "$lib/server/github-app.js";

interface Installation {
  id: number;
  account: { login: string; avatar_url: string; type: string };
}

export const load: LayoutServerLoad = async ({ request, url, cookies }) => {
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);

  if (devMocksEnabled()) {
    return {
      actor: mockActor(),
      installations: mockInstallations(),
    };
  }

  const authUrl = `/auth/start?session=settings&return=${encodeURIComponent(url.pathname)}`;

  if (!actor) {
    redirect(302, authUrl);
  }

  if (!actor.token) {
    cookies.delete("slopblock_session", { path: "/" });
    redirect(302, authUrl);
  }

  const installations: Installation[] = [];

  try {
    const app = getGitHubApp();
    const iter = app.eachInstallation.iterator();
    for await (const { installation } of iter) {
      installations.push({
        id: installation.id,
        account: {
          login: (installation.account as any)?.login ?? "unknown",
          avatar_url: (installation.account as any)?.avatar_url ?? "",
          type: (installation.account as any)?.type ?? "User",
        },
      });
    }
  } catch {
    // If we can't list installations, show empty state
  }

  return {
    actor: { login: actor.login },
    installations,
  };
};
