import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

const marketplaceUpdates: any[] = [];
let matchedInstallation: any = undefined;
let listedInstallations: any[] = [];

mock.module("../src/lib/server/marketplace-store.js", {
  namedExports: {
    findInstallationByAccountLogin: async () => matchedInstallation,
    upsertGitHubMarketplacePlan: async (input: any) => {
      marketplaceUpdates.push(input);
    },
  },
});

mock.module("../src/lib/server/github-app.js", {
  namedExports: {
    verifyMarketplaceWebhookSignature: () => true,
    getGitHubApp: () => ({
      eachInstallation: {
        iterator: async function* () {
          for (const installation of listedInstallations) {
            yield { installation };
          }
        },
      },
    }),
  },
});

const { processMarketplaceWebhook } = await import("../src/lib/server/github-marketplace.js");

test("purchased marketplace event activates GitHub Marketplace access", async () => {
  marketplaceUpdates.length = 0;
  matchedInstallation = {
    installationId: "123",
    accountLogin: "acme-inc",
    accountType: "Organization",
  };
  listedInstallations = [];

  const response = await processMarketplaceWebhook({
    action: "purchased",
    effective_date: "2026-04-08T00:00:00Z",
    marketplace_purchase: {
      account: { login: "acme-inc", type: "Organization" },
      billing_cycle: "monthly",
      plan: { id: 7, name: "Pro" },
    },
  });

  assert.equal(response.status, 200);
  assert.equal(marketplaceUpdates.length, 1);
  assert.equal(marketplaceUpdates[0].installationId, "123");
  assert.equal(marketplaceUpdates[0].active, true);
  assert.equal(marketplaceUpdates[0].githubMarketplacePlanId, 7);
});

test("future cancellation does not deactivate early", async () => {
  marketplaceUpdates.length = 0;
  matchedInstallation = {
    installationId: "123",
    accountLogin: "acme-inc",
    accountType: "Organization",
  };
  listedInstallations = [];

  const response = await processMarketplaceWebhook({
    action: "cancelled",
    effective_date: "2999-01-01T00:00:00Z",
    marketplace_purchase: {
      account: { login: "acme-inc", type: "Organization" },
      billing_cycle: "monthly",
      plan: { id: 7, name: "Pro" },
    },
  });

  assert.equal(response.status, 200);
  assert.equal(marketplaceUpdates.length, 1);
  assert.equal(marketplaceUpdates[0].active, false);
});

test("falls back to GitHub installation lookup when no settings row exists", async () => {
  marketplaceUpdates.length = 0;
  matchedInstallation = undefined;
  listedInstallations = [
    {
      id: 987,
      account: { login: "octo-org", type: "Organization" },
    },
  ];

  const response = await processMarketplaceWebhook({
    action: "purchased",
    effective_date: "2026-04-08T00:00:00Z",
    marketplace_purchase: {
      account: { login: "octo-org", type: "Organization" },
      billing_cycle: "yearly",
      plan: { id: 55, name: "Team" },
    },
  });

  assert.equal(response.status, 200);
  assert.equal(marketplaceUpdates.length, 1);
  assert.equal(marketplaceUpdates[0].installationId, "987");
  assert.equal(marketplaceUpdates[0].accountLogin, "octo-org");
});
