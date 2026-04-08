import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { devMocksEnabled } from "$lib/server/dev-mocks.js";
import { getSettings, setModelsValidated } from "$lib/server/settings-store.js";
import { verifyInstallationAccess } from "$lib/server/installation-auth.js";

interface ModelTestResult {
  model: string;
  role: "generation" | "validation" | "skip";
  ok: boolean;
  error?: string;
  latencyMs?: number;
}

/**
 * Sends a minimal chat completion request to verify the model is reachable
 * and the API key has permission to use it.
 */
async function testModel(
  baseUrl: string,
  apiKey: string,
  model: string,
  role: "generation" | "validation" | "skip",
): Promise<ModelTestResult> {
  const start = Date.now();
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Say OK" }],
        max_tokens: 3,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      let message = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(body);
        message = parsed?.error?.message ?? parsed?.message ?? message;
      } catch {
        if (body.length > 0 && body.length < 200) message = body;
      }
      return { model, role, ok: false, error: message, latencyMs };
    }

    // Verify we got a valid response structure
    const data = await response.json();
    if (!data.choices?.length) {
      return { model, role, ok: false, error: "No response from model", latencyMs };
    }

    return { model, role, ok: true, latencyMs };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const message =
      err instanceof Error
        ? err.name === "TimeoutError" || err.name === "AbortError"
          ? "Request timed out (15s)"
          : err.message
        : "Unknown error";
    return { model, role, ok: false, error: message, latencyMs };
  }
}

export const POST: RequestHandler = async ({ params, request }) => {
  if (devMocksEnabled()) {
    const body = await request.json();
    const models = body.models as
      | { generation: string; validation: string; skip: string }
      | undefined;
    if (!models) {
      return json({ ok: false, error: "Missing models" }, { status: 400 });
    }
    // Simulate success for all models in dev mode
    const results: ModelTestResult[] = [
      { model: models.generation, role: "generation", ok: true, latencyMs: 120 },
      { model: models.validation, role: "validation", ok: true, latencyMs: 95 },
      { model: models.skip, role: "skip", ok: true, latencyMs: 80 },
    ];
    return json({ ok: true, results });
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
  const models = body.models as
    | { generation: string; validation: string; skip: string }
    | undefined;

  if (!models || !models.generation?.trim() || !models.validation?.trim() || !models.skip?.trim()) {
    return json(
      { ok: false, error: "All three models (generation, validation, skip) are required." },
      { status: 400 },
    );
  }

  const settings = await getSettings(params.installationId);
  if (!settings?.llmApiKey || !settings.llmBaseUrl) {
    return json(
      {
        ok: false,
        error: "No API key or base URL configured. Connect OpenRouter or set a manual key first.",
      },
      { status: 400 },
    );
  }

  // Deduplicate — if the same model is used for multiple roles, only test it once
  const uniqueModels = new Map<string, ("generation" | "validation" | "skip")[]>();
  for (const [role, model] of [
    ["generation", models.generation.trim()],
    ["validation", models.validation.trim()],
    ["skip", models.skip.trim()],
  ] as const) {
    const existing = uniqueModels.get(model);
    if (existing) {
      existing.push(role);
    } else {
      uniqueModels.set(model, [role]);
    }
  }

  // Test all unique models in parallel
  const testPromises = Array.from(uniqueModels.entries()).map(([model, roles]) =>
    testModel(settings.llmBaseUrl!, settings.llmApiKey!, model, roles[0]).then((result) =>
      // Expand deduplicated result back to all roles
      roles.map((role) => ({ ...result, role })),
    ),
  );

  const nested = await Promise.all(testPromises);
  const results = nested.flat();
  const allPassed = results.every((r) => r.ok);

  if (allPassed) {
    const fingerprint = [
      models.generation.trim(),
      models.validation.trim(),
      models.skip.trim(),
    ].join("|");
    await setModelsValidated(params.installationId, fingerprint);
  }

  return json({ ok: allPassed, results });
};
