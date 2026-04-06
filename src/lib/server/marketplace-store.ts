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
}

/**
 * Returns true if the installation is on a paid Marketplace plan.
 * Defaults to free if no settings row exists.
 */
export async function isPaidPlan(installationId: string): Promise<boolean> {
  const row = await prisma.installationSettings.findUnique({
    where: { installationId },
    select: { marketplacePlan: true }
  });
  return row?.marketplacePlan === "paid";
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
      marketplacePlanId: true
    }
  });

  if (!row) return undefined;

  return {
    installationId: row.installationId,
    accountLogin: row.accountLogin,
    accountType: row.accountType,
    marketplacePlan: (row.marketplacePlan as MarketplacePlan) ?? "free",
    marketplacePlanId: row.marketplacePlanId ?? undefined
  };
}

/**
 * Upserts plan information for an installation. Called from marketplace_purchase webhooks.
 */
export async function upsertPlan(input: PlanRecord): Promise<void> {
  await prisma.installationSettings.upsert({
    where: { installationId: input.installationId },
    create: {
      installationId: input.installationId,
      accountLogin: input.accountLogin,
      accountType: input.accountType,
      marketplacePlan: input.marketplacePlan,
      marketplacePlanId: input.marketplacePlanId ?? null
    },
    update: {
      accountLogin: input.accountLogin,
      accountType: input.accountType,
      marketplacePlan: input.marketplacePlan,
      marketplacePlanId: input.marketplacePlanId ?? null
    }
  });

  logInfo("marketplace.plan.upserted", {
    installationId: input.installationId,
    accountLogin: input.accountLogin,
    accountType: input.accountType,
    plan: input.marketplacePlan,
    planId: input.marketplacePlanId
  });
}

/**
 * Downgrades an installation to the free plan. Called on cancellation.
 */
export async function downgradeToFree(installationId: string): Promise<void> {
  await prisma.installationSettings.updateMany({
    where: { installationId },
    data: { marketplacePlan: "free", marketplacePlanId: null }
  });

  logInfo("marketplace.plan.downgraded_to_free", { installationId });
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
        notIn: [SessionStatus.quota_exceeded, SessionStatus.skipped]
      }
    }
  });
}
