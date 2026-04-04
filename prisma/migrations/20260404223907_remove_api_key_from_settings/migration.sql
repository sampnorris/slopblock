/*
  Warnings:

  - You are about to drop the column `llmApiKey` on the `InstallationSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "InstallationSettings" DROP COLUMN "llmApiKey";
