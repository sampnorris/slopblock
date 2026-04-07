import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSessionActor } from "$lib/server/auth.js";
import { devMocksEnabled } from "$lib/server/dev-mocks.js";
import { getSessionById } from "$lib/server/session-store.js";
import { submitFeedbackScore } from "$lib/server/langfuse.js";

export const POST: RequestHandler = async ({ params, request }) => {
  if (devMocksEnabled()) {
    return json({ ok: true });
  }

  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const actor = getSessionActor({ headers: { cookie: cookieHeader } } as any);

  if (!actor) {
    return json({ ok: false, message: "Not authenticated." }, { status: 401 });
  }

  const session = await getSessionById(params.token);
  if (!session) {
    return json({ ok: false, message: "Session not found." }, { status: 404 });
  }

  if (actor.login !== session.authorLogin) {
    return json(
      { ok: false, message: "Only the PR author can provide feedback." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const value = body?.value;

  if (typeof value !== "number" || (value !== 0 && value !== 1)) {
    return json({ ok: false, message: "value must be 0 or 1." }, { status: 400 });
  }

  if (!session.traceId) {
    // No trace was recorded (LangFuse not configured during generation)
    return json({ ok: true, message: "Feedback noted (no trace linked)." });
  }

  await submitFeedbackScore({
    traceId: session.traceId,
    value,
    comment: typeof body?.comment === "string" ? body.comment : undefined,
  });

  return json({ ok: true });
};
