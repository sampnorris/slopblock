import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { getSettings, upsertSettings } from "$lib/server/settings-store.js";

export const GET: RequestHandler = async ({ params, request }) => {
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);
  if (!actor) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }

  const settings = await getSettings(params.installationId);
  if (!settings) {
    return json({ settings: null });
  }

  return json({
    settings: {
      ...settings,
      llmApiKey: settings.llmApiKey ? "••••••••" : undefined
    }
  });
};

export const PUT: RequestHandler = async ({ params, request }) => {
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);
  if (!actor) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();

  const existing = await getSettings(params.installationId);

  const updated = await upsertSettings({
    installationId: params.installationId,
    accountLogin: body.accountLogin ?? existing?.accountLogin ?? actor.login,
    llmApiKey: body.llmApiKey === "••••••••" ? existing?.llmApiKey : (body.llmApiKey || undefined),
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

  return json({
    ok: true,
    settings: {
      ...updated,
      llmApiKey: updated.llmApiKey ? "••••••••" : undefined
    }
  });
};
