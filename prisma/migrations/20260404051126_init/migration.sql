-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('awaiting_answer', 'passed', 'skipped', 'failed');

-- CreateTable
CREATE TABLE "PullRequestSession" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "repositoryOwner" TEXT NOT NULL,
    "repositoryName" TEXT NOT NULL,
    "pullNumber" INTEGER NOT NULL,
    "authorLogin" TEXT NOT NULL,
    "headSha" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL,
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "retryMode" TEXT NOT NULL,
    "summary" TEXT,
    "skipReason" TEXT,
    "failureMessage" TEXT,
    "commentId" TEXT,
    "quiz" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PullRequestSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PullRequestSession_installationId_idx" ON "PullRequestSession"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "PullRequestSession_repositoryOwner_repositoryName_pullNumbe_key" ON "PullRequestSession"("repositoryOwner", "repositoryName", "pullNumber");
