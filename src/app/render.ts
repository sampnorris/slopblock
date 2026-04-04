import { SessionStatus } from "@prisma/client";
import type { QuizPayload } from "../types.js";
import type { SessionRecord } from "./session-store.js";
import { sessionAnswerUrl, sessionTargetUrl } from "./github-service.js";

function currentQuestion(quiz: QuizPayload | undefined, index: number) {
  return quiz?.questions[index];
}

export function renderSessionComment(session: SessionRecord): string {
  const lines: string[] = ["## slopblock", ""];

  if (session.status === SessionStatus.skipped) {
    lines.push("Status: skipped", "", session.skipReason ?? "This pull request matched skip rules.");
    lines.push("", `[Open pull request](${sessionTargetUrl(session)})`);
    return lines.join("\n");
  }

  if (session.status === SessionStatus.passed) {
    lines.push("Status: passed", "", `Quiz passed for commit ${session.headSha.slice(0, 7)}.`);
    lines.push("", `[Open pull request](${sessionTargetUrl(session)})`);
    return lines.join("\n");
  }

  const quiz = session.quiz;
  const question = currentQuestion(quiz, session.currentQuestionIndex);
  const progress = quiz ? `${session.currentQuestionIndex + 1}/${quiz.questions.length}` : "0/0";
  lines.push("Status: waiting for PR author");
  lines.push(`Progress: ${progress}`);

  if (session.summary) {
    lines.push("", session.summary);
  }

  if (session.failureMessage) {
    lines.push("", `Last result: ${session.failureMessage}`);
  }

  if (question) {
    lines.push("", `Question ${session.currentQuestionIndex + 1} of ${quiz?.questions.length ?? 0}`);
    lines.push(question.prompt, "");

    question.options.forEach((option, index) => {
      const label = String.fromCharCode(65 + index);
      lines.push(`${label}. ${option.text}`);
    });

    if (question.diffAnchors.length > 0) {
      lines.push("", `Based on: ${question.diffAnchors.join(", ")}`);
    }

    lines.push("", `[Answer Question](${sessionAnswerUrl(session)})`);
    lines.push("Choose from the multiple-choice options in the linked UI.");
    lines.push("Only the PR author can answer.");
  }

  return lines.join("\n");
}
