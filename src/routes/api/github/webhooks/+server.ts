import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getInstallationOctokit, verifyWebhookSignature } from "$lib/server/github-app.js";
import { setCommitStatus } from "$lib/server/github-service.js";
import { logError, logInfo } from "$lib/server/log.js";
import {
  handlePullRequestWebhook,
  handlePullRequestClosed,
  handleQuizCommand,
  MissingModelError,
  MissingProviderError,
} from "$lib/server/service.js";
import { InsufficientCreditsError, TokenBudgetExceededError } from "$lib/server/openai.js";

export const POST: RequestHandler = async ({ request }) => {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? undefined;

  if (!verifyWebhookSignature(rawBody, signature)) {
    logInfo("webhook.signature_invalid", {
      event: request.headers.get("x-github-event"),
    });
    return json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event") ?? undefined;
  const payload = JSON.parse(rawBody);
  const deliveryId = request.headers.get("x-github-delivery");

  logInfo("webhook.received", {
    event,
    action: payload.action,
    deliveryId,
    installationId: payload.installation?.id,
    repository: payload.repository?.full_name,
    pullNumber: payload.pull_request?.number ?? payload.issue?.number,
  });

  if (event === "ping") {
    logInfo("webhook.ping", { deliveryId });
    return json({ ok: true });
  }

  if (!payload.installation?.id) {
    logInfo("webhook.ignored_no_installation", { event, action: payload.action, deliveryId });
    return json({ ignored: true, reason: "No installation context" }, { status: 202 });
  }

  try {
    logInfo("webhook.auth_installation.start", {
      installationId: payload.installation.id,
      deliveryId,
    });
    let octokit;
    try {
      octokit = await getInstallationOctokit(payload.installation.id);
    } catch (authError) {
      logError("webhook.auth_installation.failed", authError, {
        installationId: payload.installation.id,
        repository: payload.repository?.full_name,
        deliveryId,
      });
      return json({ ignored: true, reason: "Installation authentication failed" }, { status: 202 });
    }
    logInfo("webhook.auth_installation.complete", {
      installationId: payload.installation.id,
      deliveryId,
    });

    if (event === "pull_request" && payload.action === "closed") {
      await handlePullRequestClosed(payload);
    } else if (event === "pull_request") {
      await handlePullRequestWebhook(octokit, payload);
    } else if (
      event === "issue_comment" &&
      payload.action === "created" &&
      payload.issue?.pull_request
    ) {
      const body = (payload.comment?.body ?? "").trim();
      if (body === "/quiz") {
        await handleQuizCommand(octokit, payload);
      } else {
        logInfo("webhook.ignored_comment", { event, action: payload.action, deliveryId });
      }
    } else {
      logInfo("webhook.ignored_event", { event, action: payload.action, deliveryId });
    }

    logInfo("webhook.completed", { event, action: payload.action, deliveryId });
    return json({ ok: true });
  } catch (error) {
    const isPrEvent = event === "pull_request" && payload.pull_request;
    const isCommentEvent = event === "issue_comment" && payload.issue?.pull_request;
    if (
      (error instanceof MissingProviderError ||
        error instanceof MissingModelError ||
        error instanceof InsufficientCreditsError ||
        error instanceof TokenBudgetExceededError) &&
      (isPrEvent || isCommentEvent)
    ) {
      const owner = payload.repository.owner.login;
      const repo = payload.repository.name;
      const pr = payload.pull_request ?? payload.issue;
      const description =
        error instanceof InsufficientCreditsError
          ? "LLM provider has insufficient credits. Add credits and re-trigger."
          : error instanceof TokenBudgetExceededError
            ? error.fallback === "fail"
              ? `Token budget exceeded (${error.tokensUsed.toLocaleString()}/${error.budget.toLocaleString()}). Merge blocked.`
              : `Token budget exceeded (${error.tokensUsed.toLocaleString()}/${error.budget.toLocaleString()}). Quiz skipped.`
            : error instanceof MissingModelError
              ? "LLM models are not fully configured. Select all required models in settings."
              : "No LLM provider configured. Visit slopblock settings to connect one.";
      try {
        await setCommitStatus({
          octokit: await getInstallationOctokit(payload.installation.id),
          owner,
          repo,
          sha: pr.head.sha,
          state:
            error instanceof TokenBudgetExceededError
              ? error.fallback === "fail"
                ? "failure"
                : "success"
              : "error",
          description,
        });
      } catch {
        /* best effort */
      }
      logInfo("webhook.provider_error", {
        type: error.name,
        installationId: payload.installation.id,
        repository: `${owner}/${repo}`,
        pullNumber: pr.number,
      });
      return json({ ok: true, skipped: error.name });
    }

    logError("webhook.failed", error, {
      event,
      action: payload.action,
      deliveryId,
      installationId: payload.installation?.id,
      repository: payload.repository?.full_name,
      pullNumber: payload.pull_request?.number ?? payload.issue?.number,
    });
    return json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
};
