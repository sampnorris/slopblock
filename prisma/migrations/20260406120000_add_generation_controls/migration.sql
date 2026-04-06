-- AlterTable
ALTER TABLE "InstallationSettings"
ADD COLUMN     "quizGenerationMaxAttempts" INTEGER,
ADD COLUMN     "llmMaxJsonAttempts" INTEGER,
ADD COLUMN     "allowBestEffortFallback" BOOLEAN;
