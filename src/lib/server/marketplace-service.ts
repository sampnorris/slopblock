import { logInfo } from "./log.js";
import { downgradeToFree, upsertPlan, type MarketplacePlan } from "./marketplace-store.js";

/**
 * Derives the internal plan name from a GitHub Marketplace plan object.
 * The free plan is identified by a zero price; everything else is paid.
 */
function resolvePlan(marketplacePlan: { monthly_price_in_cents: number }): MarketplacePlan {
  return marketplacePlan.monthly_price_in_cents === 0 ? "free" : "paid";
}

/**
 * Handles all `marketplace_purchase` webhook event actions from GitHub.
 *
 * Actions: purchased | changed | pending_change | pending_change_cancelled | cancelled
 *
 * GitHub docs: https://docs.github.com/en/webhooks/webhook-events-and-payloads#marketplace_purchase
 */
export async function handleMarketplacePurchase(payload: any): Promise<void> {
  const action: string = payload.action;
  const account = payload.marketplace_purchase?.account;
  const plan = payload.marketplace_purchase?.plan;
  const installationId = String(account?.id ?? "");

  logInfo("marketplace.purchase.received", {
    action,
    accountLogin: account?.login,
    accountType: account?.type,
    planName: plan?.name,
    planId: plan?.id,
    monthlyPriceCents: plan?.monthly_price_in_cents
  });

  if (!account?.login || !installationId) {
    logInfo("marketplace.purchase.ignored_missing_account", { action });
    return;
  }

  if (action === "cancelled") {
    // Downgrade to free — the cancellation takes effect at end of billing cycle
    // but we downgrade immediately in our DB; GitHub stops sending events after this.
    await downgradeToFree(installationId);
    return;
  }

  if (
    action === "purchased" ||
    action === "changed" ||
    action === "pending_change_cancelled"
  ) {
    // purchased: new subscription
    // changed: plan upgrade or downgrade, or billing cycle change
    // pending_change_cancelled: a scheduled downgrade was cancelled — revert to current paid plan
    const resolvedPlan = resolvePlan(plan);

    await upsertPlan({
      installationId,
      accountLogin: account.login,
      accountType: account.type ?? "User",
      marketplacePlan: resolvedPlan,
      marketplacePlanId: plan?.id
    });
    return;
  }

  if (action === "pending_change") {
    // A plan change is scheduled but not yet effective (e.g. a downgrade at end of cycle).
    // We do not apply it yet — we wait for the `changed` event when it takes effect.
    logInfo("marketplace.purchase.pending_change_deferred", {
      accountLogin: account.login,
      pendingPlanName: payload.previous_marketplace_purchase?.plan?.name
    });
    return;
  }

  logInfo("marketplace.purchase.unhandled_action", { action });
}
