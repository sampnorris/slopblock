-- AlterTable
ALTER TABLE "InstallationSettings" ADD COLUMN     "modelsValidatedAt" TIMESTAMP(3),
ADD COLUMN     "modelsValidatedFingerprint" TEXT;
