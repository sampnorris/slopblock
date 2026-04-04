import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { getSettings } from "$lib/server/settings-store.js";

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
}

export const GET: RequestHandler = async ({ params, request }) => {
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);
  if (!actor) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }

  const settings = await getSettings(params.installationId);
  if (!settings?.llmApiKey || !settings.llmBaseUrl?.includes("openrouter")) {
    return json({ models: [], source: "static" });
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { authorization: `Bearer ${settings.llmApiKey}` }
    });

    if (!res.ok) {
      return json({ models: [], source: "error", message: `OpenRouter returned ${res.status}` });
    }

    const data = await res.json() as { data: OpenRouterModel[] };
    const models = data.data
      .filter((m) => m.id && m.name)
      .map((m) => ({
        id: m.id,
        name: m.name,
        contextLength: m.context_length,
        promptPrice: m.pricing?.prompt,
        completionPrice: m.pricing?.completion
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return json({ models, source: "openrouter" });
  } catch {
    return json({ models: [], source: "error", message: "Failed to fetch models" });
  }
};
