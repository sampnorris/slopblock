import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { getSettings } from "$lib/server/settings-store.js";

export const load: PageServerLoad = async ({ params, request, url }) => {
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);

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
    settings: settings ? {
      llmBaseUrl: settings.llmBaseUrl,
      llmGenerationModel: settings.llmGenerationModel,
      llmValidationModel: settings.llmValidationModel,
      llmSkipModel: settings.llmSkipModel,
      questionCountMin: settings.questionCountMin,
      questionCountMax: settings.questionCountMax,
      retryMode: settings.retryMode,
      skipBots: settings.skipBots,
      skipForks: settings.skipForks
    } : null
  };
};
