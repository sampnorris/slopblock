import { SessionStatus } from "@prisma/client";
import type { SessionRecord } from "./session-store.js";
import { sessionAnswerUrl, sessionTargetUrl } from "./github-service.js";

export function renderSessionComment(session: SessionRecord): string {
  const lines: string[] = ["## slopblock", ""];

  if (session.status === SessionStatus.skipped) {
    lines.push(`**Status:** skipped`, "", session.skipReason ?? "This pull request matched skip rules.");
    return lines.join("\n");
  }

  if (session.status === SessionStatus.passed) {
    lines.push(`**Status:** passed :white_check_mark:`, "", `Quiz passed for commit \`${session.headSha.slice(0, 7)}\`.`);
    return lines.join("\n");
  }

  const questionCount = session.quiz?.questions.length ?? session.questionCount;
  lines.push(`**Status:** waiting for PR author`);
  lines.push(`**Questions:** ${questionCount}`);

  if (session.summary) {
    lines.push("", session.summary);
  }

  lines.push("", `[:arrow_right: **Take the quiz**](${sessionAnswerUrl(session)})`);
  lines.push("", "Answer all questions correctly to pass. Only the PR author can submit.");

  return lines.join("\n");
}
