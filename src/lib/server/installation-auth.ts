import { getGitHubApp } from "./github-app.js";
import { logInfo } from "./log.js";

export type AccessResult = "granted" | "denied" | "not_found";

export async function verifyInstallationAccess(
  installationId: string | number,
  actorLogin: string,
  actorToken?: string,
): Promise<AccessResult> {
  const ctx = { installationId: String(installationId), actorLogin };

  try {
    const app = getGitHubApp();
    const numericId = typeof installationId === "string" ? Number(installationId) : installationId;

    if (!Number.isFinite(numericId) || numericId <= 0) {
      logInfo("installation_auth.invalid_id", ctx);
      return "not_found";
    }

    const { data: installation } = await app.octokit.request(
      "GET /app/installations/{installation_id}",
      { installation_id: numericId },
    );

    const account = installation.account as { login: string; type: string } | null | undefined;

    if (!account?.login) {
      logInfo("installation_auth.no_account", ctx);
      return "not_found";
    }

    const accountLogin = account.login.toLowerCase();
    const actor = actorLogin.toLowerCase();

    logInfo("installation_auth.check", {
      ...ctx,
      accountLogin: account.login,
      accountType: account.type,
      hasActorToken: !!actorToken,
    });

    if (account.type === "User") {
      const granted = actor === accountLogin;
      logInfo("installation_auth.user_check", { ...ctx, granted });
      return granted ? "granted" : "denied";
    }

    if (actorToken) {
      const membership = await checkOrgMembership(actorToken, account.login, ctx);
      if (membership === "admin") return "granted";
    }

    return "denied";
  } catch (error) {
    const is404 =
      error != null &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status: number }).status === 404;

    logInfo(is404 ? "installation_auth.not_found" : "installation_auth.verify_failed", {
      ...ctx,
      error: error instanceof Error ? error.message : String(error),
    });
    return is404 ? "not_found" : "denied";
  }
}

async function checkOrgMembership(
  actorToken: string,
  orgLogin: string,
  ctx: Record<string, unknown>,
): Promise<"admin" | "member" | null> {
  try {
    const response = await fetch(
      `https://api.github.com/user/memberships/orgs/${encodeURIComponent(orgLogin)}`,
      {
        headers: {
          authorization: `Bearer ${actorToken}`,
          accept: "application/vnd.github+json",
          "user-agent": "slopblock",
        },
      },
    );

    if (response.ok) {
      const membership = (await response.json()) as { state?: string; role?: string };
      logInfo("installation_auth.membership_response", {
        ...ctx,
        status: response.status,
        state: membership.state,
        role: membership.role,
      });
      if (membership.state === "active") {
        return membership.role === "admin" ? "admin" : "member";
      }
      return null;
    }

    const body = await response.text().catch(() => "<unreadable>");
    logInfo("installation_auth.membership_failed", {
      ...ctx,
      status: response.status,
      body: body.slice(0, 500),
    });
    return null;
  } catch (err) {
    logInfo("installation_auth.membership_error", {
      ...ctx,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}


