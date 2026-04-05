CREATE TABLE "QuizAttempt" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT,
  "installationId" TEXT NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "repositoryOwner" TEXT NOT NULL,
  "repositoryName" TEXT NOT NULL,
  "pullNumber" INTEGER NOT NULL,
  "authorLogin" TEXT NOT NULL,
  "headSha" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "retryMode" TEXT NOT NULL,
  "generationModel" TEXT,
  "validationModel" TEXT,
  "questionCount" INTEGER NOT NULL,
  "correctCount" INTEGER NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "answers" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuizAttempt_sessionId_idx" ON "QuizAttempt"("sessionId");
CREATE INDEX "QuizAttempt_installationId_idx" ON "QuizAttempt"("installationId");
CREATE INDEX "QuizAttempt_repositoryOwner_repositoryName_idx" ON "QuizAttempt"("repositoryOwner", "repositoryName");
CREATE INDEX "QuizAttempt_authorLogin_idx" ON "QuizAttempt"("authorLogin");
CREATE INDEX "QuizAttempt_passed_idx" ON "QuizAttempt"("passed");
CREATE INDEX "QuizAttempt_createdAt_idx" ON "QuizAttempt"("createdAt");
