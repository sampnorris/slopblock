import type { ParsedAnswers, QuizPayload, SlopblockState } from "./types.js";
import { base64Json, decodeBase64Json } from "./util.js";

const STATE_MARKER = "slopblock:state";

export function buildQuizComment(state: SlopblockState): string {
  const lines: string[] = [];
  lines.push("## slopblock");
  lines.push("");

  if (state.status === "skipped") {
    lines.push(`Status: skipped`);
    lines.push("");
    lines.push(state.skipReason ?? "This pull request matched configured skip rules.");
  } else if (state.status === "passed") {
    lines.push(`Status: passed`);
    lines.push("");
    lines.push(`Quiz passed on attempt ${state.attempt}.`);
  } else if (state.status === "failed") {
    lines.push(`Status: retry required`);
    lines.push("");
    lines.push(`Latest attempt failed: ${state.failReason ?? "incorrect answers"}`);
  } else {
    lines.push(`Status: waiting for PR author`);
    lines.push("");
    lines.push(`Quiz generated for commit ${state.headSha.slice(0, 7)}.`);
  }

  if (state.quiz) {
    lines.push("");
    lines.push(state.quiz.summary);
    lines.push("");

    state.quiz.questions.forEach((question, index) => {
      lines.push(`${index + 1}. ${question.prompt}`);
      question.options.forEach((option) => {
        lines.push(`   ${option.key}. ${option.text}`);
      });
      lines.push("");
    });

    lines.push("Reply in a new comment using this exact format:");
    lines.push("");
    lines.push("```text");
    lines.push("slopblock answers");
    state.quiz.questions.forEach((question, index) => {
      lines.push(`${index + 1}: ${question.options[0]?.key ?? "A"}`);
    });
    lines.push("```");

    lines.push("");
    lines.push("Only the PR author's reply will be graded.");

    if (state.retryMode === "maintainer_rerun") {
      lines.push("");
      lines.push("If you fail, a maintainer must rerun the workflow to issue a new quiz.");
    } else if (state.retryMode === "same_quiz") {
      lines.push("");
      lines.push("If you fail, you may answer the same quiz again.");
    } else if (state.retryMode === "new_quiz") {
      lines.push("");
      lines.push("If you fail, slopblock will post a new quiz for the current diff.");
    }
  }

  lines.push("");
  lines.push(`<!-- ${STATE_MARKER} ${base64Json(state)} -->`);
  return lines.join("\n");
}

export function parseStateFromComment(body: string): SlopblockState | undefined {
  const match = body.match(new RegExp(`<!-- ${STATE_MARKER} ([A-Za-z0-9+/=]+) -->`));
  if (!match) {
    return undefined;
  }
  return decodeBase64Json<SlopblockState>(match[1]);
}

export function parseAnswers(body: string): ParsedAnswers | undefined {
  if (!/slopblock answers/i.test(body)) {
    return undefined;
  }

  const answers = new Map<number, string>();
  for (const line of body.split("\n")) {
    const match = line.match(/^\s*(?:q)?(\d+)\s*:\s*([A-E])\s*$/i);
    if (match) {
      answers.set(Number(match[1]), match[2].toUpperCase());
    }
  }

  if (answers.size === 0) {
    return undefined;
  }

  return { answers, raw: body };
}

export function gradeAnswers(quiz: QuizPayload, answers: ParsedAnswers): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  quiz.questions.forEach((question, index) => {
    const answer = answers.answers.get(index + 1);
    if (!answer) {
      failures.push(`Question ${index + 1} was not answered.`);
      return;
    }
    if (answer !== question.correctOption) {
      failures.push(`Question ${index + 1} expected ${question.correctOption} but received ${answer}.`);
    }
  });

  return {
    passed: failures.length === 0,
    failures
  };
}
