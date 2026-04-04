-- CreateTable
CREATE TABLE "InstallationSettings" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "llmApiKey" TEXT,
    "llmBaseUrl" TEXT,
    "llmGenerationModel" TEXT,
    "llmValidationModel" TEXT,
    "llmSkipModel" TEXT,
    "questionCountMin" INTEGER,
    "questionCountMax" INTEGER,
    "retryMode" TEXT,
    "skipBots" BOOLEAN,
    "skipForks" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstallationSettings_installationId_key" ON "InstallationSettings"("installationId");
