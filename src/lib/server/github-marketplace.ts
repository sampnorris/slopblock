import { getGitHubApp } from "./github-app.js";
import {
  findInstallationByAccountLogin,
  upsertGitHubMarketplacePlan,
} from "./marketplace-store.js";
import { logInfo } from "./log.js";

interface MarketplaceAccount {
  login?: string;
  type?: string;
}

interface MarketplacePlan {
  id?: number;
  name?: string;
}

interface MarketplacePurchase {
  account?: MarketplaceAccount;
  billing_cycle?: string;
  plan?: MarketplacePlan;
}

export interface MarketplaceWebhookPayload {
  action?: string;
  effective_date?: string;
  marketplace_purchase?: MarketplacePurchase;
}

async function resolveInstallation(accountLogin: string, accountType: string) {
  const existing = await findInstallationByAccountLogin(accountLogin);
  if (existing) {
    return existing;
  }

  const app = getGitHubApp();
  const iter = app.eachInstallation.iterator();

  for await (const { installation } of iter) {
    const installationAccount = installation.account as
      | { login?: string; type?: string }
      | null
      | undefined;
    if (installationAccount?.login?.toLowerCase() !== accountLogin.toLowerCase()) {
      continue;
    }

    return {
      installationId: String(installation.id),
      accountLogin: installationAccount.login,
      accountType: installationAccount.type ?? accountType,
    };
  }

  return undefined;
}

function actionActivatesImmediately(action: string, effectiveDate?: Date): boolean {
  if (action === "purchased") {
    return true;
  }

  if (action !== "changed" && action !== "cancelled") {
    return false;
  }

  return !effectiveDate || effectiveDate.getTime() <= Date.now();
}

export async function processMarketplaceWebhook(payload: MarketplaceWebhookPayload) {
  const action = payload.action ?? "";
  const accountLogin = payload.marketplace_purchase?.account?.login?.trim();
  const accountType = payload.marketplace_purchase?.account?.type ?? "User";
  const effectiveDate = payload.effective_date ? new Date(payload.effective_date) : undefined;

  logInfo("marketplace_webhook.received", {
    action,
    accountLogin,
    accountType,
    effectiveDate: effectiveDate?.toISOString(),
    planId: payload.marketplace_purchase?.plan?.id,
  });

  if (!accountLogin) {
    return { ignored: true, reason: "Missing marketplace account login", status: 202 };
  }

  const installation = await resolveInstallation(accountLogin, accountType);
  if (!installation) {
    logInfo("marketplace_webhook.no_installation_match", { accountLogin, accountType });
    return { ignored: true, reason: "No installation found for account", status: 202 };
  }

  if (action === "pending_change" || action === "pending_change_cancelled") {
    logInfo("marketplace_webhook.ignored_pending_change", {
      action,
      installationId: installation.installationId,
    });
    return { ok: true, ignored: action, status: 200 };
  }

  const active = actionActivatesImmediately(action, effectiveDate)
    ? action !== "cancelled"
    : action === "purchased";

  await upsertGitHubMarketplacePlan({
    installationId: installation.installationId,
    accountLogin: installation.accountLogin,
    accountType: installation.accountType,
    githubMarketplacePlanId: payload.marketplace_purchase?.plan?.id,
    githubMarketplacePlanName: payload.marketplace_purchase?.plan?.name,
    githubMarketplaceBillingCycle: payload.marketplace_purchase?.billing_cycle,
    githubMarketplaceEffectiveDate: effectiveDate,
    active,
  });

  return { ok: true, installationId: installation.installationId, active, status: 200 };
}
