import { SessionStatus } from "@prisma/client";
import { prisma } from "./db.js";
import { logInfo } from "./log.js";

export const FREE_PLAN_DAILY_QUIZ_LIMIT = 10;

export type MarketplacePlan = "free" | "paid";

export interface PlanRecord {
  installationId: string;
  accountLogin: string;
  accountType: string;
  marketplacePlan: MarketplacePlan;
  marketplacePlanId?: number;
  bmacActive?: boolean;
  githubMarketplaceActive?: boolean;
  githubMarketplacePlanId?: number;
  githubMarketplacePlanName?: string;
  githubMarketplaceBillingCycle?: string;
  githubMarketplaceEffectiveDate?: Date;
}

interface InstallationPlanState {
  installationId: string;
  accountLogin: string;
  accountType: string;
  marketplacePlan?: string | null;
  marketplacePlanId?: number | null;
  bmacActive?: boolean | null;
  githubMarketplaceActive?: boolean | null;
  githubMarketplacePlanId?: number | null;
  githubMarketplacePlanName?: string | null;
  githubMarketplaceBillingCycle?: string | null;
  githubMarketplaceEffectiveDate?: Date | null;
}

function deriveMarketplacePlanId(input: {
  marketplacePlanId?: number | null;
  githubMarketplaceActive?: boolean | null;
  githubMarketplacePlanId?: number | null;
}): number | undefined {
  if (input.githubMarketplaceActive && input.githubMarketplacePlanId != null) {
    return input.githubMarketplacePlanId;
  }

  return input.marketplacePlanId ?? undefined;
}

function deriveMarketplacePlan(input: {
  marketplacePlan?: string | null;
  bmacActive?: boolean | null;
  githubMarketplaceActive?: boolean | null;
}): MarketplacePlan {
  if (input.bmacActive || input.githubMarketplaceActive || input.marketplacePlan === "paid") {
    return "paid";
  }

  return "free";
}

/**
 * Returns true if the installation is on a paid Marketplace plan.
 * Defaults to free if no settings row exists.
 */
export async function isPaidPlan(installationId: string): Promise<boolean> {
  const row = await prisma.installationSettings.findUnique({
    where: { installationId },
    select: { marketplacePlan: true, bmacActive: true, githubMarketplaceActive: true },
  } as any);
  return deriveMarketplacePlan(row ?? {}) === "paid";
}

/**
 * Returns the current plan record for an installation, or undefined if not found.
 */
export async function getPlan(installationId: string): Promise<PlanRecord | undefined> {
  const row = await prisma.installationSettings.findUnique({
    where: { installationId },
    select: {
      installationId: true,
      accountLogin: true,
      accountType: true,
      marketplacePlan: true,
      marketplacePlanId: true,
      bmacActive: true,
      githubMarketplaceActive: true,
      githubMarketplacePlanId: true,
      githubMarketplacePlanName: true,
      githubMarketplaceBillingCycle: true,
      githubMarketplaceEffectiveDate: true,
    },
  } as any);

  if (!row) return undefined;
  const planState = row as InstallationPlanState;

  return {
    installationId: planState.installationId,
    accountLogin: planState.accountLogin,
    accountType: planState.accountType,
    marketplacePlan: deriveMarketplacePlan(planState),
    marketplacePlanId: deriveMarketplacePlanId(planState),
    bmacActive: planState.bmacActive ?? undefined,
    githubMarketplaceActive: planState.githubMarketplaceActive ?? undefined,
    githubMarketplacePlanId: planState.githubMarketplacePlanId ?? undefined,
    githubMarketplacePlanName: planState.githubMarketplacePlanName ?? undefined,
    githubMarketplaceBillingCycle: planState.githubMarketplaceBillingCycle ?? undefined,
    githubMarketplaceEffectiveDate: planState.githubMarketplaceEffectiveDate ?? undefined,
  };
}

/**
 * Updates the synthetic paid/free plan view exposed to the rest of the app.
 */
async function syncDerivedPlan(installationId: string): Promise<void> {
  const row = await prisma.installationSettings.findUnique({
    where: { installationId },
    select: {
      marketplacePlanId: true,
      bmacActive: true,
      githubMarketplaceActive: true,
      githubMarketplacePlanId: true,
    },
  } as any);

  if (!row) return;
  const planState = row as InstallationPlanState;

  const marketplacePlan = deriveMarketplacePlan(planState);
  const marketplacePlanId = deriveMarketplacePlanId(planState) ?? null;

  await prisma.installationSettings.update({
    where: { installationId },
    data: {
      marketplacePlan,
      marketplacePlanId,
    },
  });
}

export async function upsertPlan(input: PlanRecord): Promise<void> {
  await prisma.installationSettings.upsert({
    where: { installationId: input.installationId },
    create: {
      installationId: input.installationId,
      accountLogin: input.accountLogin,
      accountType: input.accountType,
      marketplacePlan: input.marketplacePlan,
      marketplacePlanId: input.marketplacePlanId ?? null,
      bmacActive: input.bmacActive ?? false,
      githubMarketplaceActive: input.githubMarketplaceActive ?? false,
      githubMarketplacePlanId: input.githubMarketplacePlanId ?? null,
      githubMarketplacePlanName: input.githubMarketplacePlanName ?? null,
      githubMarketplaceBillingCycle: input.githubMarketplaceBillingCycle ?? null,
      githubMarketplaceEffectiveDate: input.githubMarketplaceEffectiveDate ?? null,
    },
    update: {
      accountLogin: input.accountLogin,
      accountType: input.accountType,
      marketplacePlan: input.marketplacePlan,
      marketplacePlanId: input.marketplacePlanId ?? null,
      ...(input.bmacActive !== undefined ? { bmacActive: input.bmacActive } : {}),
      ...(input.githubMarketplaceActive !== undefined
        ? { githubMarketplaceActive: input.githubMarketplaceActive }
        : {}),
      ...(input.githubMarketplacePlanId !== undefined
        ? { githubMarketplacePlanId: input.githubMarketplacePlanId }
        : {}),
      ...(input.githubMarketplacePlanName !== undefined
        ? { githubMarketplacePlanName: input.githubMarketplacePlanName }
        : {}),
      ...(input.githubMarketplaceBillingCycle !== undefined
        ? { githubMarketplaceBillingCycle: input.githubMarketplaceBillingCycle }
        : {}),
      ...(input.githubMarketplaceEffectiveDate !== undefined
        ? { githubMarketplaceEffectiveDate: input.githubMarketplaceEffectiveDate }
        : {}),
    },
  } as any);

  await syncDerivedPlan(input.installationId);

  logInfo("marketplace.plan.upserted", {
    installationId: input.installationId,
    accountLogin: input.accountLogin,
    accountType: input.accountType,
    plan: input.marketplacePlan,
    planId: input.marketplacePlanId,
    bmacActive: input.bmacActive,
    githubMarketplaceActive: input.githubMarketplaceActive,
    githubMarketplacePlanId: input.githubMarketplacePlanId,
  });
}

/**
 * Downgrades an installation to the free plan. Called on cancellation.
 */
export async function downgradeToFree(installationId: string): Promise<void> {
  await prisma.installationSettings.updateMany({
    where: { installationId },
    data: {
      marketplacePlan: "free",
      marketplacePlanId: null,
      bmacActive: false,
      githubMarketplaceActive: false,
      githubMarketplacePlanId: null,
      githubMarketplacePlanName: null,
      githubMarketplaceBillingCycle: null,
      githubMarketplaceEffectiveDate: null,
    },
  } as any);

  logInfo("marketplace.plan.downgraded_to_free", { installationId });
}

export async function activateBmacPlan(input: {
  installationId: string;
  accountLogin: string;
  accountType: string;
}): Promise<void> {
  await upsertPlan({
    installationId: input.installationId,
    accountLogin: input.accountLogin,
    accountType: input.accountType,
    marketplacePlan: "paid",
    bmacActive: true,
  });

  logInfo("marketplace.plan.bmac_activated", {
    installationId: input.installationId,
    accountLogin: input.accountLogin,
  });
}

export async function upsertGitHubMarketplacePlan(input: {
  installationId: string;
  accountLogin: string;
  accountType: string;
  githubMarketplacePlanId?: number;
  githubMarketplacePlanName?: string;
  githubMarketplaceBillingCycle?: string;
  githubMarketplaceEffectiveDate?: Date;
  active: boolean;
}): Promise<void> {
  const githubMarketplacePlanId = input.active ? input.githubMarketplacePlanId : undefined;
  const githubMarketplacePlanName = input.active ? input.githubMarketplacePlanName : null;
  const githubMarketplaceBillingCycle = input.active ? input.githubMarketplaceBillingCycle : null;

  await upsertPlan({
    installationId: input.installationId,
    accountLogin: input.accountLogin,
    accountType: input.accountType,
    marketplacePlan: input.active ? "paid" : "free",
    marketplacePlanId: githubMarketplacePlanId,
    githubMarketplaceActive: input.active,
    githubMarketplacePlanId,
    githubMarketplacePlanName: githubMarketplacePlanName ?? undefined,
    githubMarketplaceBillingCycle: githubMarketplaceBillingCycle ?? undefined,
    githubMarketplaceEffectiveDate: input.githubMarketplaceEffectiveDate,
  });

  logInfo("marketplace.plan.github_marketplace_updated", {
    installationId: input.installationId,
    accountLogin: input.accountLogin,
    active: input.active,
    planId: input.githubMarketplacePlanId,
    effectiveDate: input.githubMarketplaceEffectiveDate?.toISOString(),
  });
}

export async function findInstallationByAccountLogin(accountLogin: string): Promise<
  | {
      installationId: string;
      accountLogin: string;
      accountType: string;
    }
  | undefined
> {
  const normalized = accountLogin.trim().toLowerCase();

  const existing = await prisma.installationSettings.findFirst({
    where: {
      accountLogin: { equals: normalized, mode: "insensitive" },
    },
    select: {
      installationId: true,
      accountLogin: true,
      accountType: true,
    },
  });

  if (existing) {
    return existing;
  }

  const installations = await prisma.installationSettings.findMany({
    select: {
      installationId: true,
      accountLogin: true,
      accountType: true,
    },
  });

  return installations.find((installation) => installation.accountLogin.toLowerCase() === normalized);
}

export async function reconcileDueGitHubMarketplaceDowngrades(now = new Date()): Promise<number> {
  const dueInstallations = (await prisma.installationSettings.findMany({
    where: {
      githubMarketplaceActive: true,
      githubMarketplaceEffectiveDate: { lte: now },
    },
    select: {
      installationId: true,
      accountLogin: true,
      accountType: true,
      githubMarketplacePlanId: true,
      githubMarketplaceEffectiveDate: true,
    },
  } as any)) as Array<{
    installationId: string;
    accountLogin: string;
    accountType: string;
    githubMarketplacePlanId?: number | null;
    githubMarketplaceEffectiveDate?: Date | null;
  }>;

  for (const installation of dueInstallations) {
    await upsertGitHubMarketplacePlan({
      installationId: installation.installationId,
      accountLogin: installation.accountLogin,
      accountType: installation.accountType,
      githubMarketplacePlanId: installation.githubMarketplacePlanId ?? undefined,
      githubMarketplaceEffectiveDate: installation.githubMarketplaceEffectiveDate ?? now,
      active: false,
    });
  }

  if (dueInstallations.length > 0) {
    logInfo("marketplace.plan.github_marketplace_reconciled", {
      count: dueInstallations.length,
      at: now.toISOString(),
    });
  }

  return dueInstallations.length;
}

/**
 * Counts the number of quiz generations that have occurred today (UTC) for an installation.
 * Only counts sessions that are actual quiz generations — skips quota_exceeded and skipped rows.
 */
export async function countQuizGenerationsToday(installationId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  return prisma.pullRequestSession.count({
    where: {
      installationId: String(installationId),
      createdAt: { gte: startOfDay },
      status: {
        notIn: [SessionStatus.quota_exceeded, SessionStatus.skipped],
      },
    },
  });
}
