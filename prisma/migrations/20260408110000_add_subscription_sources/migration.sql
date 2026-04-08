-- AlterTable
ALTER TABLE "InstallationSettings"
ADD COLUMN "bmacActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "githubMarketplaceActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "githubMarketplacePlanId" INTEGER,
ADD COLUMN "githubMarketplacePlanName" TEXT,
ADD COLUMN "githubMarketplaceBillingCycle" TEXT,
ADD COLUMN "githubMarketplaceEffectiveDate" TIMESTAMP(3);

-- Backfill existing paid rows as BMAC-paid so Marketplace cancellations never remove them.
UPDATE "InstallationSettings"
SET "bmacActive" = true
WHERE "marketplacePlan" = 'paid';
