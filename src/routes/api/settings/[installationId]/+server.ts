import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { getSettings, upsertSettings, clearApiKey } from "$lib/server/settings-store.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

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
  const existing = await getSettings(params.installationId);

  const llmBaseUrl = isNonEmptyString(body.llmBaseUrl) ? body.llmBaseUrl.trim() : existing?.llmBaseUrl;
  const llmGenerationModel = isNonEmptyString(body.llmGenerationModel) ? body.llmGenerationModel.trim() : undefined;
  const llmValidationModel = isNonEmptyString(body.llmValidationModel) ? body.llmValidationModel.trim() : undefined;
  const llmSkipModel = isNonEmptyString(body.llmSkipModel) ? body.llmSkipModel.trim() : undefined;

  if (!existing?.llmApiKey || !llmBaseUrl) {
    return json(
      { ok: false, error: "Connect OpenRouter or provide an API key and base URL before saving settings." },
      { status: 400 }
    );
  }

  if (!llmGenerationModel || !llmValidationModel || !llmSkipModel) {
    return json(
      { ok: false, error: "Select generation, validation, and skip models before saving settings." },
      { status: 400 }
    );
  }

  // Don't pass llmApiKey through PUT -- it's set via OpenRouter OAuth or manual key endpoint
  const updated = await upsertSettings({
    installationId: params.installationId,
    accountLogin: body.accountLogin ?? actor.login,
    llmBaseUrl,
    llmGenerationModel,
    llmValidationModel,
    llmSkipModel,
    questionCountMin: body.questionCountMin != null ? Number(body.questionCountMin) : undefined,
    questionCountMax: body.questionCountMax != null ? Number(body.questionCountMax) : undefined,
    retryMode: body.retryMode || undefined,
    skipBots: body.skipBots != null ? Boolean(body.skipBots) : undefined,
    skipForks: body.skipForks != null ? Boolean(body.skipForks) : undefined,
    customSystemPrompt: body.customSystemPrompt ?? undefined,
    customQuizInstructions: body.customQuizInstructions ?? undefined
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
