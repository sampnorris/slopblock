import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { devMocksEnabled, mockActor, mockInstallations } from "$lib/server/dev-mocks.js";
import { getGitHubApp } from "$lib/server/github-app.js";

interface Installation {
  id: number;
  account: { login: string; avatar_url: string; type: string };
}

export const load: LayoutServerLoad = async ({ request, url }) => {
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);

  if (devMocksEnabled()) {
    return {
      actor: mockActor(),
      installations: mockInstallations(),
    };
  }

  if (!actor) {
    redirect(302, `/auth/start?session=settings&return=${encodeURIComponent(url.pathname)}`);
  }

  const actorLogin = actor.login.toLowerCase();
  const userOrgs = new Set<string>();
  let orgFetchSucceeded = false;

  if (actor.token) {
    try {
      const orgsResponse = await fetch("https://api.github.com/user/orgs?per_page=100", {
        headers: {
          authorization: `Bearer ${actor.token}`,
          accept: "application/vnd.github+json",
          "user-agent": "slopblock",
        },
      });
      if (orgsResponse.ok) {
        orgFetchSucceeded = true;
        const orgs = (await orgsResponse.json()) as { login: string }[];
        for (const org of orgs) {
          userOrgs.add(org.login.toLowerCase());
        }
      }
    } catch {}
  }

  const installations: Installation[] = [];

  try {
    const app = getGitHubApp();
    const iter = app.eachInstallation.iterator();
    for await (const { installation } of iter) {
      const account = installation.account as
        | { login: string; avatar_url: string; type: string }
        | null
        | undefined;
      const login = account?.login ?? "unknown";
      const type = account?.type ?? "User";

      const isOwnInstall = type === "User" && login.toLowerCase() === actorLogin;
      const isOrgMember = type === "Organization" && userOrgs.has(login.toLowerCase());

      if (isOwnInstall || isOrgMember || (!orgFetchSucceeded && type === "Organization")) {
        installations.push({
          id: installation.id,
          account: { login, avatar_url: account?.avatar_url ?? "", type },
        });
      }
    }
  } catch {
    // If we can't list installations, show empty state
  }

  return {
    actor: { login: actor.login },
    installations,
  };
};
