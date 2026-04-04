#!/usr/bin/env node

// src/cli.ts
import { readFile } from "node:fs/promises";

// src/util.ts
function truncate(value, max = 3e3) {
  return value.length <= max ? value : `${value.slice(0, max)}
...[truncated]`;
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
    return await this.chatForJson(
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
    const diffSummary = await readFile(readArg("--diff") ?? "fixtures/diff.txt", "utf8");
    const changedFiles = (await readFile(readArg("--files") ?? "fixtures/files.txt", "utf8")).split("\n").map((line) => line.trim()).filter(Boolean);
    const result = await client.evaluateBorderlineSkip({ diffSummary, changedFiles });
    process.stdout.write(`${JSON.stringify(result, null, 2)}
`);
    return;
  }
  if (command === "quiz") {
    const diffSummary = await readFile(readArg("--diff") ?? "fixtures/diff.txt", "utf8");
    const repoContext = JSON.parse(await readFile(readArg("--context") ?? "fixtures/context.json", "utf8"));
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
//# sourceMappingURL=cli.js.map
