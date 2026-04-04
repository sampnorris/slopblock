#!/usr/bin/env node
"use strict";

// src/cli.ts
var import_promises = require("node:fs/promises");

// src/util.ts
function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}
function truncate(value, max = 3e3) {
  return value.length <= max ? value : `${value.slice(0, max)}
...[truncated]`;
}

// src/quiz.ts
var OPTION_KEYS = ["A", "B", "C", "D", "E"];
function asRecord(value) {
  return value && typeof value === "object" ? value : void 0;
}
function normalizeOptionKey(value, index) {
  if (typeof value === "string") {
    const candidate = value.trim().toUpperCase();
    if (OPTION_KEYS.includes(candidate)) {
      return candidate;
    }
  }
  return OPTION_KEYS[index];
}
function normalizeOptionText(value) {
  if (typeof value === "string") {
    const text = normalizeWhitespace(value);
    return text || void 0;
  }
  const record = asRecord(value);
  if (!record) {
    return void 0;
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
  return void 0;
}
function normalizeOptions(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((option, index) => {
    if (typeof option === "string") {
      return {
        key: OPTION_KEYS[index],
        text: normalizeWhitespace(option)
      };
    }
    const record = asRecord(option);
    if (!record) {
      return void 0;
    }
    const key = normalizeOptionKey(record.key ?? record.label, index);
    const text = normalizeOptionText(record);
    if (!key || !text) {
      return void 0;
    }
    return { key, text };
  }).filter((option) => Boolean(option)).slice(0, OPTION_KEYS.length);
}
function normalizeCorrectOption(value, options) {
  if (typeof value === "number") {
    const index = value > 0 ? value - 1 : value;
    return options[index]?.key;
  }
  if (typeof value === "string") {
    const candidate = value.trim();
    const asKey = candidate.toUpperCase();
    if (OPTION_KEYS.includes(asKey)) {
      return options.find((option) => option.key === asKey)?.key;
    }
    return options.find((option) => normalizeWhitespace(option.text) === normalizeWhitespace(candidate))?.key;
  }
  return void 0;
}
function normalizeQuestion(value, index) {
  const record = asRecord(value);
  if (!record) {
    return void 0;
  }
  const prompt = typeof record.prompt === "string" ? normalizeWhitespace(record.prompt) : "";
  const options = normalizeOptions(record.options);
  const correctOption = normalizeCorrectOption(record.correctOption, options);
  const explanation = typeof record.explanation === "string" ? normalizeWhitespace(record.explanation) : "";
  const diffAnchors = Array.isArray(record.diffAnchors) ? record.diffAnchors.filter((anchor) => typeof anchor === "string" && Boolean(normalizeWhitespace(anchor))) : [];
  const focus = record.focus === "behavior" || record.focus === "risk" || record.focus === "implementation" ? record.focus : "behavior";
  if (!prompt || options.length < 3 || !correctOption) {
    return void 0;
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
function normalizeQuizPayload(value) {
  const record = asRecord(value) ?? {};
  const summary = typeof record.summary === "string" ? normalizeWhitespace(record.summary) : "";
  const questions = Array.isArray(record.questions) ? record.questions.map((question, index) => normalizeQuestion(question, index)).filter((question) => Boolean(question)) : [];
  return {
    summary: summary || "Review the questions below about the changed behavior in this pull request.",
    questions
  };
}

// src/openai.ts
var OpenAICompatibleClient = class {
  constructor(options) {
    this.options = options;
  }
  get maxAttempts() {
    return this.options.maxAttempts ?? 2;
  }
  async chat(messages, temperature = 0.2) {
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`
      },
      body: JSON.stringify({
        model: this.options.model,
        temperature,
        messages
      })
    });
    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
    }
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content.map((item) => item.text ?? "").join("\n");
    }
    throw new Error("LLM response did not include message content.");
  }
  parseJson(value) {
    const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1] ?? value;
    const firstBrace = candidate.indexOf("{");
    const firstBracket = candidate.indexOf("[");
    const start = [firstBrace, firstBracket].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
    const cleaned = candidate.slice(start).trim();
    return JSON.parse(cleaned);
  }
  async chatForJson(messages, temperature = 0.2) {
    let lastError;
    let prompt = messages;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const content = await this.chat(prompt, temperature);
      try {
        return this.parseJson(content);
      } catch (error) {
        lastError = error;
        prompt = [
          ...messages,
          {
            role: "user",
            content: "Your previous response was not valid JSON. Reply again using only strict JSON with no markdown fences, explanation, or prose."
          }
        ];
      }
    }
    throw new Error(`Failed to parse valid JSON from model response: ${String(lastError)}`);
  }
  async evaluateBorderlineSkip(input) {
    return await this.chatForJson(
      [
        {
          role: "system",
          content: "You are deciding whether a pull request is so obvious that it should skip a comprehension quiz. Favor skipping only for low-risk, clearly obvious changes. Return strict JSON."
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: "Decide whether to skip the quiz for this borderline PR.",
              output: {
                outcome: "skip or quiz",
                reason: "one sentence",
                certainty: "high, medium, or low"
              },
              changedFiles: input.changedFiles,
              diffSummary: truncate(input.diffSummary, 5e3)
            },
            null,
            2
          )
        }
      ],
      0
    );
  }
  async generateQuiz(input) {
    const rawQuiz = await this.chatForJson(
      [
        {
          role: "system",
          content: "You generate strict JSON for a merge-gating PR quiz. Use repository context only as background. Every question must be answerable from the diff and changed behavior only. Prefer behavior and risk questions, but include implementation detail if it helps prove understanding. Multiple choice only."
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              instructions: [
                "Ask only about the diff.",
                "Do not ask trivia about unchanged code.",
                "Make distractors plausible.",
                "Use 4 options unless 5 is necessary.",
                "Return JSON with summary and questions.",
                "Each question needs id, prompt, options, correctOption, explanation, diffAnchors, and focus.",
                'options must be an array of objects shaped exactly like {"key":"A","text":"option text"}.',
                "correctOption must be a single option key letter such as A, B, C, D, or E.",
                "diffAnchors should reference changed file paths or changed symbols."
              ],
              questionCount: input.questionCount,
              repoContext: input.repoContext,
              diffSummary: truncate(input.diffSummary, 14e3)
            },
            null,
            2
          )
        }
      ],
      0.2
    );
    return normalizeQuizPayload(rawQuiz);
  }
  async validateQuiz(input) {
    return await this.chatForJson(
      [
        {
          role: "system",
          content: "You validate a PR quiz for grounding and quality. Reject questions that depend on unchanged code knowledge, are ambiguous, or have weak distractors. Return strict JSON."
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: "Validate this quiz.",
              output: {
                valid: true,
                issues: ["list of issues if invalid"]
              },
              quiz: input.quiz,
              repoContext: input.repoContext,
              diffSummary: truncate(input.diffSummary, 1e4)
            },
            null,
            2
          )
        }
      ],
      0
    );
  }
};

// src/cli.ts
function readArg(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : void 0;
}
async function main() {
  const command = process.argv[2];
  const baseUrl = process.env.SLOPBLOCK_BASE_URL ?? "https://api.openai.com/v1";
  const apiKey = process.env.SLOPBLOCK_API_KEY;
  const model = process.env.SLOPBLOCK_MODEL ?? "gpt-4.1-mini";
  if (!apiKey) {
    throw new Error("Set SLOPBLOCK_API_KEY before using the CLI.");
  }
  const client = new OpenAICompatibleClient({ baseUrl, apiKey, model });
  if (command === "skip") {
    const diffSummary = await (0, import_promises.readFile)(readArg("--diff") ?? "fixtures/diff.txt", "utf8");
    const changedFiles = (await (0, import_promises.readFile)(readArg("--files") ?? "fixtures/files.txt", "utf8")).split("\n").map((line) => line.trim()).filter(Boolean);
    const result = await client.evaluateBorderlineSkip({ diffSummary, changedFiles });
    process.stdout.write(`${JSON.stringify(result, null, 2)}
`);
    return;
  }
  if (command === "quiz") {
    const diffSummary = await (0, import_promises.readFile)(readArg("--diff") ?? "fixtures/diff.txt", "utf8");
    const repoContext = JSON.parse(await (0, import_promises.readFile)(readArg("--context") ?? "fixtures/context.json", "utf8"));
    const questionCount = Number(readArg("--questions") ?? "3");
    const quiz = await client.generateQuiz({ diffSummary, repoContext, questionCount });
    const validation = await client.validateQuiz({ quiz, repoContext, diffSummary });
    process.stdout.write(`${JSON.stringify({ quiz, validation }, null, 2)}
`);
    return;
  }
  process.stdout.write("Usage: slopblock <skip|quiz> [--diff path] [--files path] [--context path] [--questions n]\n");
}
main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}
`);
  process.exitCode = 1;
});
//# sourceMappingURL=cli.cjs.map
