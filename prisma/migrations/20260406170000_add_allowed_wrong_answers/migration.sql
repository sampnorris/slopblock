-- Add tolerated wrong-answer controls for settings and sessions.
ALTER TABLE "InstallationSettings"
ADD COLUMN "allowedWrongAnswers" INTEGER;

ALTER TABLE "PullRequestSession"
ADD COLUMN "allowedWrongAnswers" INTEGER NOT NULL DEFAULT 0;
