import { reconcileDueGitHubMarketplaceDowngrades } from "./marketplace-store.js";

export async function runSubscriptionsCron() {
  const reconciled = await reconcileDueGitHubMarketplaceDowngrades();
  return { ok: true, reconciled };
}
