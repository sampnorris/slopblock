import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { getSettings, upsertSettings } from "$lib/server/settings-store.js";
import { encrypt } from "$lib/server/crypto.js";

/** Exchange an OpenRouter PKCE code for an API key, then store it encrypted. */
export const POST: RequestHandler = async ({ request }) => {
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);
  if (!actor) {
    return json({ ok: false, message: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json();
  const { code, codeVerifier, installationId } = body;
  if (!code || !codeVerifier || !installationId) {
    return json({ ok: false, message: "Missing code, codeVerifier, or installationId." }, { status: 400 });
  }

  // Exchange code for API key with OpenRouter
  const exchangeRes = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      code_challenge_method: "S256"
    })
  });

  const exchangeJson = await exchangeRes.json() as { key?: string; error?: string };
  if (!exchangeJson.key) {
    return json({ ok: false, message: exchangeJson.error ?? "Failed to exchange code for API key." }, { status: 400 });
  }

  // Store encrypted
  const existing = await getSettings(installationId);
  await upsertSettings({
    installationId,
    accountLogin: existing?.accountLogin ?? actor.login,
    llmApiKey: exchangeJson.key,
    llmBaseUrl: existing?.llmBaseUrl ?? "https://openrouter.ai/api/v1",
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
