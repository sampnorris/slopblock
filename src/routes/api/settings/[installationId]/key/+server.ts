import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { devMocksEnabled } from "$lib/server/dev-mocks.js";
import { getSettings, upsertSettings } from "$lib/server/settings-store.js";

/** Set an API key manually (for non-OAuth providers). */
export const POST: RequestHandler = async ({ params, request }) => {
  if (devMocksEnabled()) {
    return json({ ok: true });
  }

  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);
  if (!actor) {
    return json({ ok: false, message: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json();
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";

  if (!apiKey || !baseUrl) {
    return json({ ok: false, message: "Manual connections require both an API key and base URL." }, { status: 400 });
  }

  const existing = await getSettings(params.installationId);
  await upsertSettings({
    installationId: params.installationId,
    accountLogin: existing?.accountLogin ?? actor.login,
    llmApiKey: apiKey,
    llmBaseUrl: baseUrl,
    llmGenerationModel: existing?.llmGenerationModel,
    llmValidationModel: existing?.llmValidationModel,
    llmSkipModel: existing?.llmSkipModel,
    questionCountMin: existing?.questionCountMin,
    questionCountMax: existing?.questionCountMax,
    retryMode: existing?.retryMode,
    skipBots: existing?.skipBots,
    skipForks: existing?.skipForks
  });

  return json({ ok: true });
};
