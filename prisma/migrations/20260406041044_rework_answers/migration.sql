-- AlterTable
ALTER TABLE "InstallationSettings" ADD COLUMN     "maxTokenBudget" INTEGER,
ADD COLUMN     "tokenBudgetFallback" TEXT;
