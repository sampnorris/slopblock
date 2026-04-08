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
 */
export async function verifyInstallationAccess(
  installationId: string | number,
  actorLogin: string,
): Promise<boolean> {
  try {
    const app = getGitHubApp();
    const numericId = typeof installationId === "string" ? Number(installationId) : installationId;

    if (!Number.isFinite(numericId) || numericId <= 0) {
      return false;
    }

    const { data: installation } = await app.octokit.request(
      "GET /app/installations/{installation_id}",
      { installation_id: numericId },
    );

    const account = installation.account as { login: string; type: string } | null | undefined;

    if (!account?.login) {
      return false;
    }

    const accountLogin = account.login.toLowerCase();
    const actor = actorLogin.toLowerCase();

    // User-type installation: actor must be the account owner
    if (account.type === "User") {
      return actor === accountLogin;
    }

    // Org-type installation: check if actor is a member of the org
    // Use the App's installation token to check org membership
    const installationOctokit = await app.getInstallationOctokit(numericId);
    try {
      const { status } = await (installationOctokit as any).request(
        "GET /orgs/{org}/members/{username}",
        { org: account.login, username: actorLogin },
      );
      return status === 204;
    } catch {
      // 404 = not a member, or insufficient permissions to check
      return false;
    }
  } catch (error) {
    logInfo("installation_auth.verify_failed", {
      installationId: String(installationId),
      actorLogin,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
