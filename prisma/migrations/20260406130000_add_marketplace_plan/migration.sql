-- AlterTable
ALTER TABLE "InstallationSettings" ADD COLUMN "accountType" TEXT NOT NULL DEFAULT 'User';
ALTER TABLE "InstallationSettings" ADD COLUMN "marketplacePlan" TEXT;
ALTER TABLE "InstallationSettings" ADD COLUMN "marketplacePlanId" INTEGER;
