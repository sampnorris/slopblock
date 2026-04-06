import type { QuizPayload, QuizQuestion } from "./types.js";
import { normalizeWhitespace } from "./util.js";

const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function normalizeOptionKey(value: unknown, index: number): QuizQuestion["options"][number]["key"] | undefined {
  if (typeof value === "string") {
    const candidate = value.trim().toUpperCase();
    if (OPTION_KEYS.includes(candidate as (typeof OPTION_KEYS)[number])) {
      return candidate as QuizQuestion["options"][number]["key"];
    }
  }

  return OPTION_KEYS[index];
}

function normalizeOptionText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const text = normalizeWhitespace(value);
    return text || undefined;
  }

  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const candidates = [record.text, record.value, record.option, record.content, record.body, record.description];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const text = normalizeWhitespace(candidate);
      if (text) {
        return text;
      }
    }
  }

  return undefined;
}

function normalizeOptions(value: unknown): QuizQuestion["options"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((option, index) => {
      if (typeof option === "string") {
        return {
          key: OPTION_KEYS[index],
          text: normalizeWhitespace(option)
        };
      }

      const record = asRecord(option);
      if (!record) {
        return undefined;
      }

      const key = normalizeOptionKey(record.key ?? record.label, index);
      const text = normalizeOptionText(record);
      if (!key || !text) {
        return undefined;
      }

      return { key, text };
    })
    .filter((option): option is QuizQuestion["options"][number] => Boolean(option))
    .slice(0, OPTION_KEYS.length);
}

function normalizeCorrectOption(value: unknown, options: QuizQuestion["options"]): QuizQuestion["correctOption"] | undefined {
  if (typeof value === "number") {
    const index = value > 0 ? value - 1 : value;
    return options[index]?.key;
  }

  if (typeof value === "string") {
    const candidate = value.trim();
    const asKey = candidate.toUpperCase();
    if (OPTION_KEYS.includes(asKey as (typeof OPTION_KEYS)[number])) {
      return options.find((option) => option.key === asKey)?.key;
    }

    return options.find((option) => normalizeWhitespace(option.text) === normalizeWhitespace(candidate))?.key;
  }

  return undefined;
}

function normalizeQuestion(value: unknown, index: number): QuizQuestion | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const prompt = typeof record.prompt === "string" ? normalizeWhitespace(record.prompt) : "";
  const options = normalizeOptions(record.options);
  const correctOption = normalizeCorrectOption(record.correctOption, options);
  const explanation = typeof record.explanation === "string" ? normalizeWhitespace(record.explanation) : "";
  const diffAnchors = Array.isArray(record.diffAnchors)
    ? record.diffAnchors.filter((anchor): anchor is string => typeof anchor === "string" && Boolean(normalizeWhitespace(anchor)))
    : [];
  const focus = record.focus === "behavior" || record.focus === "risk" || record.focus === "implementation" ? record.focus : "behavior";

  if (!prompt || options.length < 3 || !correctOption) {
    return undefined;
  }

  return {
    id: typeof record.id === "string" && normalizeWhitespace(record.id) ? record.id : `q${index + 1}`,
    prompt,
    options,
    correctOption,
    explanation: explanation || "Correct answer verified against the diff.",
    diffAnchors,
    focus
  };
}

export function normalizeQuizPayload(value: unknown): QuizPayload {
  const record = asRecord(value) ?? {};
  const summary = typeof record.summary === "string" ? normalizeWhitespace(record.summary) : "";
  const questions = Array.isArray(record.questions)
    ? record.questions.map((question, index) => normalizeQuestion(question, index)).filter((question): question is QuizQuestion => Boolean(question))
    : [];

  return {
    summary: summary || "Review the questions below about the changed behavior in this pull request.",
    questions
  };
}

export function validateQuizPayload(quiz: QuizPayload, expectedQuestionCount?: number): string[] {
  const issues: string[] = [];
  if (!quiz.summary.trim()) {
    issues.push("Quiz summary is empty.");
  }

  if (typeof expectedQuestionCount === "number" && quiz.questions.length !== expectedQuestionCount) {
    issues.push(`Quiz must contain exactly ${expectedQuestionCount} questions.`);
  }

  if (quiz.questions.length === 0) {
    issues.push("Quiz did not contain any valid questions.");
  }

  quiz.questions.forEach((question, index) => {
    if (!question.prompt.trim()) {
      issues.push(`Question ${index + 1} is missing a prompt.`);
    }
    if (question.options.length !== 3) {
      issues.push(`Question ${index + 1} must have exactly 3 options.`);
    }
    const optionKeys = new Set(question.options.map((option) => option.key));
    if (optionKeys.size !== question.options.length) {
      issues.push(`Question ${index + 1} contains duplicate option keys.`);
    }
    const optionTexts = new Set(question.options.map((option) => normalizeWhitespace(option.text).toLowerCase()));
    if (optionTexts.size !== question.options.length) {
      issues.push(`Question ${index + 1} contains duplicate option text.`);
    }
    if (!question.options.some((option) => option.key === question.correctOption)) {
      issues.push(`Question ${index + 1} has a correct option that does not exist in the options list.`);
    }
  });

  return issues;
}
