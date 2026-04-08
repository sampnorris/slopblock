import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

const rows = new Map<string, any>();

function clone<T>(value: T): T {
  return structuredClone(value);
}

function mergeUpdate(target: any, data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    target[key] = value;
  }
}

mock.module("../src/lib/server/db.js", {
  namedExports: {
    prisma: {
      installationSettings: {
        findUnique: async ({ where }: any) => {
          const row = rows.get(where.installationId);
          return row ? clone(row) : null;
        },
        findFirst: async ({ where }: any) => {
          const equals = where.accountLogin.equals.toLowerCase();
          const row = [...rows.values()].find(
            (candidate) => candidate.accountLogin.toLowerCase() === equals,
          );
          return row ? clone(row) : null;
        },
        findMany: async ({ where }: any = {}) => {
          const values = [...rows.values()].map((row) => clone(row));
          if (!where) return values;

          return values.filter((row) => {
            if (where.githubMarketplaceActive !== undefined) {
              if (row.githubMarketplaceActive !== where.githubMarketplaceActive) return false;
            }

            const dueDate = where.githubMarketplaceEffectiveDate?.lte;
            if (dueDate) {
              if (!row.githubMarketplaceEffectiveDate) return false;
              if (
                new Date(row.githubMarketplaceEffectiveDate).getTime() > new Date(dueDate).getTime()
              ) {
                return false;
              }
            }

            return true;
          });
        },
        upsert: async ({ where, create, update }: any) => {
          const existing = rows.get(where.installationId);
          if (existing) {
            const next = clone(existing);
            mergeUpdate(next, update);
            rows.set(where.installationId, next);
            return clone(next);
          }

          const created = {
            id: `settings_${where.installationId}`,
            installationId: where.installationId,
            accountLogin: create.accountLogin,
            accountType: create.accountType,
            marketplacePlan: create.marketplacePlan ?? null,
            marketplacePlanId: create.marketplacePlanId ?? null,
            bmacActive: create.bmacActive ?? false,
            githubMarketplaceActive: create.githubMarketplaceActive ?? false,
            githubMarketplacePlanId: create.githubMarketplacePlanId ?? null,
            githubMarketplacePlanName: create.githubMarketplacePlanName ?? null,
            githubMarketplaceBillingCycle: create.githubMarketplaceBillingCycle ?? null,
            githubMarketplaceEffectiveDate: create.githubMarketplaceEffectiveDate ?? null,
          };
          rows.set(where.installationId, created);
          return clone(created);
        },
        update: async ({ where, data }: any) => {
          const row = rows.get(where.installationId);
          if (!row) throw new Error("Missing row");
          const next = clone(row);
          mergeUpdate(next, data);
          rows.set(where.installationId, next);
          return clone(next);
        },
        updateMany: async ({ where, data }: any) => {
          const row = rows.get(where.installationId);
          if (!row) return { count: 0 };
          const next = clone(row);
          mergeUpdate(next, data);
          rows.set(where.installationId, next);
          return { count: 1 };
        },
      },
      pullRequestSession: {
        count: async () => 0,
      },
    },
  },
});

const {
  activateBmacPlan,
  getPlan,
  isPaidPlan,
  reconcileDueGitHubMarketplaceDowngrades,
  upsertGitHubMarketplacePlan,
} = await import("../src/lib/server/marketplace-store.js");

test("marketplace cancellation does not remove BMAC-paid access", async () => {
  rows.clear();

  await activateBmacPlan({
    installationId: "1",
    accountLogin: "acme-inc",
    accountType: "Organization",
  });

  await upsertGitHubMarketplacePlan({
    installationId: "1",
    accountLogin: "acme-inc",
    accountType: "Organization",
    githubMarketplacePlanId: 42,
    githubMarketplacePlanName: "Team",
    githubMarketplaceBillingCycle: "monthly",
    githubMarketplaceEffectiveDate: new Date("2026-04-08T00:00:00Z"),
    active: true,
  });

  await upsertGitHubMarketplacePlan({
    installationId: "1",
    accountLogin: "acme-inc",
    accountType: "Organization",
    githubMarketplacePlanId: 42,
    githubMarketplaceEffectiveDate: new Date("2026-05-01T00:00:00Z"),
    active: false,
  });

  assert.equal(await isPaidPlan("1"), true);

  const plan = await getPlan("1");
  assert.ok(plan);
  assert.equal(plan.marketplacePlan, "paid");
  assert.equal(plan.bmacActive, true);
  assert.equal(plan.githubMarketplaceActive, false);
});

test("marketplace-only cancellation downgrades to free", async () => {
  rows.clear();

  await upsertGitHubMarketplacePlan({
    installationId: "2",
    accountLogin: "octo-org",
    accountType: "Organization",
    githubMarketplacePlanId: 99,
    githubMarketplacePlanName: "Pro",
    githubMarketplaceBillingCycle: "yearly",
    githubMarketplaceEffectiveDate: new Date("2026-04-08T00:00:00Z"),
    active: true,
  });

  await upsertGitHubMarketplacePlan({
    installationId: "2",
    accountLogin: "octo-org",
    accountType: "Organization",
    githubMarketplacePlanId: 99,
    githubMarketplaceEffectiveDate: new Date("2026-05-01T00:00:00Z"),
    active: false,
  });

  assert.equal(await isPaidPlan("2"), false);

  const plan = await getPlan("2");
  assert.ok(plan);
  assert.equal(plan.marketplacePlan, "free");
  assert.equal(plan.githubMarketplaceActive, false);
  assert.equal(plan.marketplacePlanId, undefined);
});

test("reconcileDueGitHubMarketplaceDowngrades only clears due marketplace entitlements", async () => {
  rows.clear();

  await activateBmacPlan({
    installationId: "3",
    accountLogin: "bmac-org",
    accountType: "Organization",
  });
  await upsertGitHubMarketplacePlan({
    installationId: "3",
    accountLogin: "bmac-org",
    accountType: "Organization",
    githubMarketplacePlanId: 11,
    githubMarketplaceEffectiveDate: new Date("2026-04-01T00:00:00Z"),
    active: true,
  });

  await upsertGitHubMarketplacePlan({
    installationId: "4",
    accountLogin: "future-org",
    accountType: "Organization",
    githubMarketplacePlanId: 12,
    githubMarketplaceEffectiveDate: new Date("2999-01-01T00:00:00Z"),
    active: true,
  });

  const reconciled = await reconcileDueGitHubMarketplaceDowngrades(
    new Date("2026-04-08T00:00:00Z"),
  );
  assert.equal(reconciled, 1);

  const bmacBacked = await getPlan("3");
  assert.ok(bmacBacked);
  assert.equal(bmacBacked.marketplacePlan, "paid");
  assert.equal(bmacBacked.bmacActive, true);
  assert.equal(bmacBacked.githubMarketplaceActive, false);

  const futureMarketplace = await getPlan("4");
  assert.ok(futureMarketplace);
  assert.equal(futureMarketplace.marketplacePlan, "paid");
  assert.equal(futureMarketplace.githubMarketplaceActive, true);
});
