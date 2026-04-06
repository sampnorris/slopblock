import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { devMocksEnabled, mockActor, mockSettings } from "$lib/server/dev-mocks.js";
import { getSettings } from "$lib/server/settings-store.js";

export const load: PageServerLoad = async ({ params, request, url }) => {
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);

  if (devMocksEnabled()) {
    const settings = mockSettings(params.installationId);

    return {
      installationId: params.installationId,
      actor: mockActor(),
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
        allowedWrongAnswers: settings.allowedWrongAnswers,
        maxTokenBudget: settings.maxTokenBudget,
        tokenBudgetFallback: settings.tokenBudgetFallback
      }
    };
  }

  if (!actor) {
    redirect(302, `/auth/start?session=settings-${params.installationId}&return=${encodeURIComponent(url.pathname)}`);
  }

  const settings = await getSettings(params.installationId);

  return {
    installationId: params.installationId,
    actor: { login: actor.login },
    hasApiKey: !!settings?.llmApiKey,
    provider: settings?.llmApiKey
      ? (settings.llmBaseUrl?.includes("openrouter") ? "openrouter" : "manual")
      : "none",
    marketplacePlan: settings?.marketplacePlan ?? "free",
    accountType: settings?.accountType ?? "User",
    settings: settings ? {
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
      allowedWrongAnswers: settings.allowedWrongAnswers,
      maxTokenBudget: settings.maxTokenBudget,
      tokenBudgetFallback: settings.tokenBudgetFallback
    } : null
  };
};
