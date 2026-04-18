/**
 * Verify that an authenticated user has access to a given GitHub App installation.
 *
 * Uses the GitHub App API to resolve the installation's account, then checks:
 * 1. User-type installations: the actor's login must match the account login.
 * 2. Org-type installations: the actor must be a member of the organization.
 */

import { getGitHubApp } from "./github-app.js";
import { logInfo } from "./log.js";

/**
 * Returns true if the given actor (by GitHub login) has access to the installation.
 * Returns false if access cannot be verified.
 *
 * @param actorToken - The actor's OAuth token (with read:org scope) for org membership checks.
 *   If not provided, falls back to the installation token (may fail for private memberships).
 */
export async function verifyInstallationAccess(
  installationId: string | number,
  actorLogin: string,
  actorToken?: string,
): Promise<boolean> {
  const ctx = { installationId: String(installationId), actorLogin };

  try {
    const app = getGitHubApp();
    const numericId = typeof installationId === "string" ? Number(installationId) : installationId;

    if (!Number.isFinite(numericId) || numericId <= 0) {
      logInfo("installation_auth.invalid_id", ctx);
      return false;
    }

    const { data: installation } = await app.octokit.request(
      "GET /app/installations/{installation_id}",
      { installation_id: numericId },
    );

    const account = installation.account as { login: string; type: string } | null | undefined;

    if (!account?.login) {
      logInfo("installation_auth.no_account", ctx);
      return false;
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
      return granted;
    }

    if (actorToken) {
      try {
        const membershipUrl = `https://api.github.com/user/memberships/orgs/${encodeURIComponent(account.login)}`;
        const response = await fetch(membershipUrl, {
          headers: {
            authorization: `Bearer ${actorToken}`,
            accept: "application/vnd.github+json",
            "user-agent": "slopblock",
          },
        });

        if (response.ok) {
          const membership = (await response.json()) as { state?: string; role?: string };
          logInfo("installation_auth.membership_response", {
            ...ctx,
            status: response.status,
            state: membership.state,
            role: membership.role,
          });
          if (membership.state === "active") {
            return true;
          }
        } else {
          const body = await response.text().catch(() => "<unreadable>");
          logInfo("installation_auth.membership_failed", {
            ...ctx,
            status: response.status,
            body: body.slice(0, 500),
          });
        }
        // Token check was inconclusive (expired, revoked, SAML SSO, etc.)
        // — fall through to installation-token fallback below.
      } catch (err) {
        logInfo("installation_auth.membership_error", {
          ...ctx,
          error: err instanceof Error ? err.message : String(err),
        });
        // Network/API error — fall through to installation-token fallback below.
      }
    }

    logInfo("installation_auth.trying_fallback", ctx);
    const installationOctokit = await app.getInstallationOctokit(numericId);
    try {
      const { status } = await (installationOctokit as any).request(
        "GET /orgs/{org}/members/{username}",
        { org: account.login, username: actorLogin },
      );
      logInfo("installation_auth.fallback_result", { ...ctx, status });
      return status === 204;
    } catch (err) {
      logInfo("installation_auth.fallback_failed", {
        ...ctx,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  } catch (error) {
    logInfo("installation_auth.verify_failed", {
      ...ctx,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
