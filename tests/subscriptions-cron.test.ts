import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

let reconciledCount = 0;

mock.module("../src/lib/server/marketplace-store.js", {
  namedExports: {
    reconcileDueGitHubMarketplaceDowngrades: async () => reconciledCount,
  },
});

const { runSubscriptionsCron } = await import("../src/lib/server/subscriptions-cron.js");

test("subscriptions cron runs reconciliation with valid auth", async () => {
  reconciledCount = 3;

  const result = await runSubscriptionsCron();

  assert.equal(result.ok, true);
  assert.equal(result.reconciled, 3);
});
