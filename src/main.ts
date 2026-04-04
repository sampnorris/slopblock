import * as core from "@actions/core";
import * as github from "@actions/github";
import { handleIssueCommentEvent, handlePullRequestEvent } from "./handlers.js";

async function run(): Promise<void> {
  const eventName = github.context.eventName;
  let outcome = "ignored";

  if (eventName === "pull_request") {
    outcome = await handlePullRequestEvent();
  } else if (eventName === "issue_comment") {
    outcome = await handleIssueCommentEvent();
  }

  core.setOutput("outcome", outcome);
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
