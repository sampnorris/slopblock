import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { devMocksEnabled, mockActor, mockSettings } from "$lib/server/dev-mocks.js";
import {
  getSettings,
  upsertSettings,
  clearApiKey,
  clearModelsValidated,
} from "$lib/server/settings-store.js";
import { verifyInstallationAccess } from "$lib/server/installation-auth.js";

const MAX_CUSTOM_PROMPT_LENGTH = 4000;
const MAX_QUIZ_GENERATION_ATTEMPTS = 10;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function asOptionalNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function maskSettings(settings: any) {
  return {
    ...settings,
    llmApiKey: undefined, // never expose, even masked
    llmApiKeyEncrypted: undefined,
    hasApiKey: !!settings.llmApiKey,
  };
}

export const GET: RequestHandler = async ({ params, request }) => {
  if (devMocksEnabled()) {
    return json({
      settings: { ...mockSettings(params.installationId), llmApiKey: undefined },
      hasApiKey: true,
    });
  }

  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);
  if (!actor) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }

  const hasAccess = await verifyInstallationAccess(params.installationId, actor.login);
  if (!hasAccess) {
    return json({ error: "You do not have access to this installation." }, { status: 403 });
  }

  const settings = await getSettings(params.installationId);
  if (!settings) {
    return json({ settings: null, hasApiKey: false });
  }

  return json({ settings: maskSettings(settings) });
};

export const PUT: RequestHandler = async ({ params, request }) => {
  if (devMocksEnabled()) {
    const body = await request.json();
    return json({
      ok: true,
      settings: {
        ...mockSettings(params.installationId),
        ...body,
        accountLogin: body.accountLogin ?? mockActor().login,
        llmApiKey: undefined,
        hasApiKey: true,
      },
    });
  }

  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);
  if (!actor) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }

  const hasAccess = await verifyInstallationAccess(params.installationId, actor.login);
  if (!hasAccess) {
    return json({ error: "You do not have access to this installation." }, { status: 403 });
  }

  const body = await request.json();
  const existing = await getSettings(params.installationId);

  const llmBaseUrl = isNonEmptyString(body.llmBaseUrl)
    ? body.llmBaseUrl.trim()
    : existing?.llmBaseUrl;
  const llmGenerationModel = isNonEmptyString(body.llmGenerationModel)
    ? body.llmGenerationModel.trim()
    : undefined;
  const llmValidationModel = isNonEmptyString(body.llmValidationModel)
    ? body.llmValidationModel.trim()
    : undefined;
  const llmSkipModel = isNonEmptyString(body.llmSkipModel) ? body.llmSkipModel.trim() : undefined;
  const questionCountMin = asOptionalNumber(body.questionCountMin);
  const questionCountMax = asOptionalNumber(body.questionCountMax);
  const quizGenerationMaxAttempts = asOptionalNumber(body.quizGenerationMaxAttempts);
  const allowedWrongAnswers = asOptionalNumber(body.allowedWrongAnswers);
  const maxTokenBudget = asOptionalNumber(body.maxTokenBudget);

  if (questionCountMin != null && questionCountMin < 1) {
    return json(
      { ok: false, error: "Minimum question count must be at least 1." },
      { status: 400 },
    );
  }

  if (questionCountMax != null && questionCountMax < 1) {
    return json(
      { ok: false, error: "Maximum question count must be at least 1." },
      { status: 400 },
    );
  }

  if (questionCountMin != null && questionCountMax != null && questionCountMin > questionCountMax) {
    return json(
      { ok: false, error: "Minimum question count cannot exceed the maximum." },
      { status: 400 },
    );
  }

  if (quizGenerationMaxAttempts != null && quizGenerationMaxAttempts < 1) {
    return json({ ok: false, error: "Generation attempts must be at least 1." }, { status: 400 });
  }

  if (
    quizGenerationMaxAttempts != null &&
    quizGenerationMaxAttempts > MAX_QUIZ_GENERATION_ATTEMPTS
  ) {
    return json(
      { ok: false, error: `Generation attempts cannot exceed ${MAX_QUIZ_GENERATION_ATTEMPTS}.` },
      { status: 400 },
    );
  }

  if (
    typeof body.customSystemPrompt === "string" &&
    body.customSystemPrompt.length > MAX_CUSTOM_PROMPT_LENGTH
  ) {
    return json(
      {
        ok: false,
        error: `Custom system prompt cannot exceed ${MAX_CUSTOM_PROMPT_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  if (
    typeof body.customQuizInstructions === "string" &&
    body.customQuizInstructions.length > MAX_CUSTOM_PROMPT_LENGTH
  ) {
    return json(
      {
        ok: false,
        error: `Custom quiz instructions cannot exceed ${MAX_CUSTOM_PROMPT_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  if (maxTokenBudget != null && maxTokenBudget < 1000) {
    return json(
      { ok: false, error: "Token budget must be at least 1,000 tokens or empty (unlimited)." },
      { status: 400 },
    );
  }

  if (
    allowedWrongAnswers != null &&
    (!Number.isInteger(allowedWrongAnswers) || allowedWrongAnswers < 0)
  ) {
    return json(
      { ok: false, error: "Allowed wrong answers must be a whole number (0 or more)." },
      { status: 400 },
    );
  }

  if (!existing?.llmApiKey || !llmBaseUrl) {
    return json(
      {
        ok: false,
        error: "Connect OpenRouter or provide an API key and base URL before saving settings.",
      },
      { status: 400 },
    );
  }

  if (!llmGenerationModel || !llmValidationModel || !llmSkipModel) {
    return json(
      {
        ok: false,
        error: "Select generation, validation, and skip models before saving settings.",
      },
      { status: 400 },
    );
  }

  // If the saved models differ from what was validated, invalidate the stored validation
  const incomingFingerprint = [llmGenerationModel, llmValidationModel, llmSkipModel].join("|");
  if (
    existing?.modelsValidatedFingerprint &&
    existing.modelsValidatedFingerprint !== incomingFingerprint
  ) {
    await clearModelsValidated(params.installationId);
  }

  // Don't pass llmApiKey through PUT -- it's set via OpenRouter OAuth or manual key endpoint
  const updated = await upsertSettings({
    installationId: params.installationId,
    accountLogin: body.accountLogin ?? actor.login,
    llmBaseUrl,
    llmGenerationModel,
    llmValidationModel,
    llmSkipModel,
    questionCountMin,
    questionCountMax,
    quizGenerationMaxAttempts,
    allowBestEffortFallback:
      body.allowBestEffortFallback != null ? Boolean(body.allowBestEffortFallback) : undefined,
    retryMode: body.retryMode || undefined,
    skipBots: body.skipBots != null ? Boolean(body.skipBots) : undefined,
    skipForks: body.skipForks != null ? Boolean(body.skipForks) : undefined,
    customSystemPrompt: body.customSystemPrompt ?? undefined,
    customQuizInstructions: body.customQuizInstructions ?? undefined,
    supporterEmail: body.supporterEmail ?? undefined,
    allowedWrongAnswers: allowedWrongAnswers ?? undefined,
    maxTokenBudget: maxTokenBudget ?? undefined,
    tokenBudgetFallback:
      body.tokenBudgetFallback === "pass" || body.tokenBudgetFallback === "fail"
        ? body.tokenBudgetFallback
        : undefined,
  });

  return json({ ok: true, settings: maskSettings(updated) });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  if (devMocksEnabled()) {
    return json({ ok: true });
  }

  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);
  if (!actor) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }

  const hasAccess = await verifyInstallationAccess(params.installationId, actor.login);
  if (!hasAccess) {
    return json({ error: "You do not have access to this installation." }, { status: 403 });
  }

  await clearApiKey(params.installationId);
  return json({ ok: true });
};
