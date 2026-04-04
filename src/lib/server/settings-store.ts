import type { InstallationSettings } from "@prisma/client";
import { prisma } from "./db.js";

export interface SettingsRecord {
  id?: string;
  installationId: string;
  accountLogin: string;
  llmApiKey?: string;
  llmBaseUrl?: string;
  llmGenerationModel?: string;
  llmValidationModel?: string;
  llmSkipModel?: string;
  questionCountMin?: number;
  questionCountMax?: number;
  retryMode?: string;
  skipBots?: boolean;
  skipForks?: boolean;
}

function fromRow(row: InstallationSettings): SettingsRecord {
  return {
    id: row.id,
    installationId: row.installationId,
    accountLogin: row.accountLogin,
    llmApiKey: row.llmApiKey ?? undefined,
    llmBaseUrl: row.llmBaseUrl ?? undefined,
    llmGenerationModel: row.llmGenerationModel ?? undefined,
    llmValidationModel: row.llmValidationModel ?? undefined,
    llmSkipModel: row.llmSkipModel ?? undefined,
    questionCountMin: row.questionCountMin ?? undefined,
    questionCountMax: row.questionCountMax ?? undefined,
    retryMode: row.retryMode ?? undefined,
    skipBots: row.skipBots ?? undefined,
    skipForks: row.skipForks ?? undefined
  };
}

export async function getSettings(installationId: string): Promise<SettingsRecord | undefined> {
  const row = await prisma.installationSettings.findUnique({
    where: { installationId }
  });
  return row ? fromRow(row) : undefined;
}

export async function upsertSettings(input: SettingsRecord): Promise<SettingsRecord> {
  const row = await prisma.installationSettings.upsert({
    where: { installationId: input.installationId },
    create: {
      installationId: input.installationId,
      accountLogin: input.accountLogin,
      llmApiKey: input.llmApiKey,
      llmBaseUrl: input.llmBaseUrl,
      llmGenerationModel: input.llmGenerationModel,
      llmValidationModel: input.llmValidationModel,
      llmSkipModel: input.llmSkipModel,
      questionCountMin: input.questionCountMin,
      questionCountMax: input.questionCountMax,
      retryMode: input.retryMode,
      skipBots: input.skipBots,
      skipForks: input.skipForks
    },
    update: {
      accountLogin: input.accountLogin,
      llmApiKey: input.llmApiKey,
      llmBaseUrl: input.llmBaseUrl,
      llmGenerationModel: input.llmGenerationModel,
      llmValidationModel: input.llmValidationModel,
      llmSkipModel: input.llmSkipModel,
      questionCountMin: input.questionCountMin,
      questionCountMax: input.questionCountMax,
      retryMode: input.retryMode,
      skipBots: input.skipBots,
      skipForks: input.skipForks
    }
  });
  return fromRow(row);
}
