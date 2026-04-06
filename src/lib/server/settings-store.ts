import type { InstallationSettings } from "@prisma/client";
import { prisma } from "./db.js";
import { encrypt, decrypt } from "./crypto.js";

export interface SettingsRecord {
  id?: string;
  installationId: string;
  accountLogin: string;
  accountType?: string;
  marketplacePlan?: string;
  marketplacePlanId?: number;
  llmApiKey?: string;
  llmBaseUrl?: string;
  llmGenerationModel?: string;
  llmValidationModel?: string;
  llmSkipModel?: string;
  questionCountMin?: number;
  questionCountMax?: number;
  quizGenerationMaxAttempts?: number;
  llmMaxJsonAttempts?: number;
  allowBestEffortFallback?: boolean;
  retryMode?: string;
  skipBots?: boolean;
  skipForks?: boolean;
  customSystemPrompt?: string;
  customQuizInstructions?: string;
}

function decryptApiKey(encrypted: string | null): string | undefined {
  if (!encrypted) return undefined;
  try {
    return decrypt(encrypted);
  } catch {
    return undefined;
  }
}

function fromRow(row: InstallationSettings): SettingsRecord {
  return {
    id: row.id,
    installationId: row.installationId,
    accountLogin: row.accountLogin,
    accountType: row.accountType,
    marketplacePlan: row.marketplacePlan ?? undefined,
    marketplacePlanId: row.marketplacePlanId ?? undefined,
    llmApiKey: decryptApiKey(row.llmApiKeyEncrypted),
    llmBaseUrl: row.llmBaseUrl ?? undefined,
    llmGenerationModel: row.llmGenerationModel ?? undefined,
    llmValidationModel: row.llmValidationModel ?? undefined,
    llmSkipModel: row.llmSkipModel ?? undefined,
    questionCountMin: row.questionCountMin ?? undefined,
    questionCountMax: row.questionCountMax ?? undefined,
    quizGenerationMaxAttempts: row.quizGenerationMaxAttempts ?? undefined,
    llmMaxJsonAttempts: row.llmMaxJsonAttempts ?? undefined,
    allowBestEffortFallback: row.allowBestEffortFallback ?? undefined,
    retryMode: row.retryMode ?? undefined,
    skipBots: row.skipBots ?? undefined,
    skipForks: row.skipForks ?? undefined,
    customSystemPrompt: row.customSystemPrompt ?? undefined,
    customQuizInstructions: row.customQuizInstructions ?? undefined
  };
}

export async function getSettings(installationId: string): Promise<SettingsRecord | undefined> {
  const row = await prisma.installationSettings.findUnique({
    where: { installationId }
  });
  return row ? fromRow(row) : undefined;
}

export async function hasApiKey(installationId: string): Promise<boolean> {
  const row = await prisma.installationSettings.findUnique({
    where: { installationId },
    select: { llmApiKeyEncrypted: true }
  });
  return !!row?.llmApiKeyEncrypted;
}

export async function clearApiKey(installationId: string): Promise<void> {
  await prisma.installationSettings.updateMany({
    where: { installationId },
    data: { llmApiKeyEncrypted: null, llmBaseUrl: null }
  });
}

export async function upsertSettings(input: SettingsRecord): Promise<SettingsRecord> {
  const encryptedKey = input.llmApiKey ? encrypt(input.llmApiKey) : undefined;

  const row = await prisma.installationSettings.upsert({
    where: { installationId: input.installationId },
    create: {
      installationId: input.installationId,
      accountLogin: input.accountLogin,
      accountType: input.accountType ?? "User",
      marketplacePlan: input.marketplacePlan,
      marketplacePlanId: input.marketplacePlanId,
      llmApiKeyEncrypted: encryptedKey ?? null,
      llmBaseUrl: input.llmBaseUrl,
      llmGenerationModel: input.llmGenerationModel,
      llmValidationModel: input.llmValidationModel,
      llmSkipModel: input.llmSkipModel,
      questionCountMin: input.questionCountMin,
      questionCountMax: input.questionCountMax,
      quizGenerationMaxAttempts: input.quizGenerationMaxAttempts,
      llmMaxJsonAttempts: input.llmMaxJsonAttempts,
      allowBestEffortFallback: input.allowBestEffortFallback,
      retryMode: input.retryMode,
      skipBots: input.skipBots,
      skipForks: input.skipForks,
      customSystemPrompt: input.customSystemPrompt,
      customQuizInstructions: input.customQuizInstructions
    },
    update: {
      accountLogin: input.accountLogin,
      accountType: input.accountType,
      // Only update plan fields if explicitly provided
      ...(input.marketplacePlan !== undefined ? { marketplacePlan: input.marketplacePlan } : {}),
      ...(input.marketplacePlanId !== undefined ? { marketplacePlanId: input.marketplacePlanId } : {}),
      // Only update key if explicitly provided (undefined means keep existing)
      ...(encryptedKey !== undefined ? { llmApiKeyEncrypted: encryptedKey } : {}),
      llmBaseUrl: input.llmBaseUrl,
      llmGenerationModel: input.llmGenerationModel,
      llmValidationModel: input.llmValidationModel,
      llmSkipModel: input.llmSkipModel,
      questionCountMin: input.questionCountMin,
      questionCountMax: input.questionCountMax,
      quizGenerationMaxAttempts: input.quizGenerationMaxAttempts,
      llmMaxJsonAttempts: input.llmMaxJsonAttempts,
      allowBestEffortFallback: input.allowBestEffortFallback,
      retryMode: input.retryMode,
      skipBots: input.skipBots,
      skipForks: input.skipForks,
      customSystemPrompt: input.customSystemPrompt,
      customQuizInstructions: input.customQuizInstructions
    }
  });
  return fromRow(row);
}
