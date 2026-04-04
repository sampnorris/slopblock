import { SessionStatus } from "@prisma/client";
import type { QuizPayload } from "../types.js";
import type { SessionRecord } from "./session-store.js";
import { REACTION_OPTIONS } from "./reactions.js";

function currentQuestion(quiz: QuizPayload | undefined, index: number) {
  return quiz?.questions[index];
}

export function renderSessionComment(session: SessionRecord): string {
  const lines: string[] = ["## slopblock", ""];

  if (session.status === SessionStatus.skipped) {
    lines.push("Status: skipped", "", session.skipReason ?? "This pull request matched skip rules.");
    return lines.join("\n");
  }

  if (session.status === SessionStatus.passed) {
    lines.push("Status: passed", "", `Quiz passed for commit ${session.headSha.slice(0, 7)}.`);
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
      const reaction = REACTION_OPTIONS[index];
      lines.push(`${reaction.emoji} ${option.text}`);
    });

    if (question.diffAnchors.length > 0) {
      lines.push("", `Based on: ${question.diffAnchors.join(", ")}`);
    }

    lines.push("", "React on this comment to answer.");
    lines.push("Only the PR author's reactions count.");
    lines.push("Supported reactions: 👍 ❤️ 🚀 👀 🎉");
  }

  return lines.join("\n");
}
