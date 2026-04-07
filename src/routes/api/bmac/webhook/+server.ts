import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { logError, logInfo } from "$lib/server/log.js";
import { prisma } from "$lib/server/db.js";
import { upsertPlan } from "$lib/server/marketplace-store.js";

/**
 * Buy Me a Coffee webhook endpoint.
 *
 * BMAC fires webhooks for payment events. We match the supporter's email
 * to an installation's `supporterEmail` field and upgrade to paid.
 *
 * Expected env: BMAC_WEBHOOK_SECRET — shared secret set in BMAC dashboard.
 */
export const POST: RequestHandler = async ({ request }) => {
  const secret = process.env.BMAC_WEBHOOK_SECRET;
  if (!secret) {
    logError("bmac.webhook.missing_secret", new Error("BMAC_WEBHOOK_SECRET not configured"), {});
    return json({ error: "Webhook not configured" }, { status: 500 });
  }

  // BMAC sends the secret in a header for verification
  const providedSecret = request.headers.get("x-bmac-webhook-secret");
  if (providedSecret !== secret) {
    logInfo("bmac.webhook.invalid_secret", {});
    return json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type: string = payload.type ?? "";
  const email: string | undefined =
    payload.data?.supporter_email ??
    payload.data?.payer_email ??
    payload.data?.email;

  logInfo("bmac.webhook.received", {
    type,
    email: email ?? "unknown",
    supporterName: payload.data?.supporter_name ?? payload.data?.payer_name,
  });

  if (!email) {
    logInfo("bmac.webhook.no_email", { type });
    return json({ ok: true, matched: false, reason: "No supporter email in payload" });
  }

  // Match the supporter email to an installation
  const normalizedEmail = email.trim().toLowerCase();
  const installation = await prisma.installationSettings.findFirst({
    where: {
      supporterEmail: { equals: normalizedEmail, mode: "insensitive" },
    },
    select: {
      installationId: true,
      accountLogin: true,
      accountType: true,
    },
  });

  if (!installation) {
    logInfo("bmac.webhook.no_match", { email: normalizedEmail, type });
    return json({ ok: true, matched: false, reason: "No installation found for this email" });
  }

  // Upgrade to paid
  await upsertPlan({
    installationId: installation.installationId,
    accountLogin: installation.accountLogin,
    accountType: installation.accountType,
    marketplacePlan: "paid",
  });

  logInfo("bmac.webhook.upgraded", {
    installationId: installation.installationId,
    accountLogin: installation.accountLogin,
    email: normalizedEmail,
    type,
  });

  return json({ ok: true, matched: true, installationId: installation.installationId });
};
