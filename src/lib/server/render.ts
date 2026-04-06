import { SessionStatus } from "@prisma/client";
import type { SessionRecord } from "./session-store.js";
import { sessionAnswerUrl, sessionTargetUrl } from "./github-service.js";
import { FREE_PLAN_DAILY_QUIZ_LIMIT } from "./marketplace-store.js";
import { GITHUB_MARKETPLACE_URL } from "$lib/constants.js";

export function renderSessionComment(session: SessionRecord): string {
  const lines: string[] = ["## slopblock", ""];
  const modelLines = [
    session.generationModel ? `**Created by:** \`${session.generationModel}\`` : undefined,
    session.validationModel ? `**Validated by:** \`${session.validationModel}\`` : undefined
  ].filter(Boolean) as string[];

  if (session.status === SessionStatus.quota_exceeded) {
    lines.push(
      `**Status:** passed :white_check_mark:`,
      "",
      `This repository has reached the free plan limit of **${FREE_PLAN_DAILY_QUIZ_LIMIT} quiz generations per day**. No quiz was generated for this pull request.`,
      "",
      `[Upgrade to a paid plan](${GITHUB_MARKETPLACE_URL}) for unlimited daily quiz generations.`
    );
    return lines.join("\n");
  }

  if (session.status === SessionStatus.skipped) {
    lines.push(`**Status:** skipped`, "", session.skipReason ?? "This pull request matched skip rules.");
    return lines.join("\n");
  }

  if (session.status === SessionStatus.passed) {
    lines.push(`**Status:** passed :white_check_mark:`);
    if (modelLines.length > 0) {
      lines.push(...modelLines);
    }
    lines.push("", `Quiz passed for commit \`${session.headSha.slice(0, 7)}\`.`);
    return lines.join("\n");
  }

  const questionCount = session.quiz?.questions.length ?? session.questionCount;
  lines.push(`**Status:** waiting for PR author`);
  lines.push(`**Questions:** ${questionCount}`);
  if (modelLines.length > 0) {
    lines.push(...modelLines);
  }

  if (session.summary) {
    lines.push("", session.summary);
  }

  lines.push("", `[:arrow_right: **Take the quiz**](${sessionAnswerUrl(session)})`);
  lines.push("", "Answer all questions correctly to pass. Only the PR author can submit.");

  return lines.join("\n");
}
