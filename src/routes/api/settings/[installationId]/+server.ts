import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { getSettings, upsertSettings, hasApiKey, clearApiKey } from "$lib/server/settings-store.js";

function maskSettings(settings: any) {
  return {
    ...settings,
    llmApiKey: undefined, // never expose, even masked
    hasApiKey: !!settings.llmApiKey
  };
}

export const GET: RequestHandler = async ({ params, request }) => {
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);
  if (!actor) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }

  const settings = await getSettings(params.installationId);
  if (!settings) {
    return json({ settings: null, hasApiKey: false });
  }

  return json({ settings: maskSettings(settings) });
};

export const PUT: RequestHandler = async ({ params, request }) => {
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);
  if (!actor) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();

  // Don't pass llmApiKey through PUT -- it's set via OpenRouter OAuth or manual key endpoint
  const updated = await upsertSettings({
    installationId: params.installationId,
    accountLogin: body.accountLogin ?? actor.login,
    llmBaseUrl: body.llmBaseUrl || undefined,
    llmGenerationModel: body.llmGenerationModel || undefined,
    llmValidationModel: body.llmValidationModel || undefined,
    llmSkipModel: body.llmSkipModel || undefined,
    questionCountMin: body.questionCountMin != null ? Number(body.questionCountMin) : undefined,
    questionCountMax: body.questionCountMax != null ? Number(body.questionCountMax) : undefined,
    retryMode: body.retryMode || undefined,
    skipBots: body.skipBots != null ? Boolean(body.skipBots) : undefined,
    skipForks: body.skipForks != null ? Boolean(body.skipForks) : undefined
  });

  return json({ ok: true, settings: maskSettings(updated) });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);
  if (!actor) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }

  await clearApiKey(params.installationId);
  return json({ ok: true });
};
