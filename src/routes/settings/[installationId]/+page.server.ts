import type { PageServerLoad } from "./$types";
import { devMocksEnabled, mockSettings } from "$lib/server/dev-mocks.js";
import { getSettings } from "$lib/server/settings-store.js";

export const load: PageServerLoad = async ({ params }) => {
  if (devMocksEnabled()) {
    const settings = mockSettings(params.installationId);

    return {
      installationId: params.installationId,
      hasApiKey: true,
      provider: "openrouter",
      marketplacePlan: settings.marketplacePlan ?? "free",
      accountType: settings.accountType ?? "User",
      settings: {
        llmBaseUrl: settings.llmBaseUrl,
        llmGenerationModel: settings.llmGenerationModel,
        llmValidationModel: settings.llmValidationModel,
        llmSkipModel: settings.llmSkipModel,
        questionCountMin: settings.questionCountMin,
        questionCountMax: settings.questionCountMax,
        quizGenerationMaxAttempts: settings.quizGenerationMaxAttempts,
        allowBestEffortFallback: settings.allowBestEffortFallback,
        retryMode: settings.retryMode,
        skipBots: settings.skipBots,
        skipForks: settings.skipForks,
        customSystemPrompt: settings.customSystemPrompt,
        customQuizInstructions: settings.customQuizInstructions,
        supporterEmail: settings.supporterEmail,
        allowedWrongAnswers: settings.allowedWrongAnswers,
        maxTokenBudget: settings.maxTokenBudget,
        tokenBudgetFallback: settings.tokenBudgetFallback,
      },
    };
  }

  // Auth is handled by the parent layout

  const settings = await getSettings(params.installationId);

  return {
    installationId: params.installationId,
    hasApiKey: !!settings?.llmApiKey,
    provider: settings?.llmApiKey
      ? settings.llmBaseUrl?.includes("openrouter")
        ? "openrouter"
        : "manual"
      : "none",
    marketplacePlan: settings?.marketplacePlan ?? "free",
    accountType: settings?.accountType ?? "User",
    settings: settings
      ? {
          llmBaseUrl: settings.llmBaseUrl,
          llmGenerationModel: settings.llmGenerationModel,
          llmValidationModel: settings.llmValidationModel,
          llmSkipModel: settings.llmSkipModel,
          questionCountMin: settings.questionCountMin,
          questionCountMax: settings.questionCountMax,
          quizGenerationMaxAttempts: settings.quizGenerationMaxAttempts,
          allowBestEffortFallback: settings.allowBestEffortFallback,
          retryMode: settings.retryMode,
          skipBots: settings.skipBots,
          skipForks: settings.skipForks,
          customSystemPrompt: settings.customSystemPrompt,
          customQuizInstructions: settings.customQuizInstructions,
          supporterEmail: settings.supporterEmail,
          allowedWrongAnswers: settings.allowedWrongAnswers,
          maxTokenBudget: settings.maxTokenBudget,
          tokenBudgetFallback: settings.tokenBudgetFallback,
        }
      : null,
  };
};
