import { createHmac, timingSafeEqual } from "node:crypto";
import { App } from "@octokit/app";
import { Octokit } from "octokit";

declare global {
  var __slopblockApp: App | undefined;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function verifyWebhookSignatureWithSecret(
  payload: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function getGitHubApp(): App {
  if (!globalThis.__slopblockApp) {
    globalThis.__slopblockApp = new App({
      appId: requiredEnv("GITHUB_APP_ID"),
      privateKey: requiredEnv("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n"),
    });
  }

  return globalThis.__slopblockApp;
}

export async function getInstallationOctokit(installationId: number) {
  const app = getGitHubApp();
  const installationAuthentication = (await app.octokit.auth({
    type: "installation",
    installationId,
  })) as { token: string };

  return new Octokit({
    auth: installationAuthentication.token,
  });
}

export function verifyWebhookSignature(payload: string, signature: string | undefined): boolean {
  return verifyWebhookSignatureWithSecret(payload, signature, requiredEnv("GITHUB_WEBHOOK_SECRET"));
}

export function verifyMarketplaceWebhookSignature(
  payload: string,
  signature: string | undefined,
): boolean {
  return verifyWebhookSignatureWithSecret(
    payload,
    signature,
    requiredEnv("GITHUB_MARKETPLACE_WEBHOOK_SECRET"),
  );
}
