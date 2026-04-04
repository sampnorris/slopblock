import { error, redirect } from "@sveltejs/kit";
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
    settings: settings ? {
      ...settings,
      llmApiKey: settings.llmApiKey ? "••••••••" : undefined
    } : null
  };
};
