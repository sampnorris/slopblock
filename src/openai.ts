import type { QuizPayload, QuizValidation, RepoContext, SkipDecision } from "./types.js";
import { truncate } from "./util.js";

interface Message {
  role: "system" | "user";
  content: string;
}

interface OpenAIClientOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxAttempts?: number;
}

export class OpenAICompatibleClient {
  constructor(private readonly options: OpenAIClientOptions) {}

  private get maxAttempts(): number {
    return this.options.maxAttempts ?? 2;
  }

  private async chat(messages: Message[], temperature = 0.2): Promise<string> {
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

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content.map((item) => item.text ?? "").join("\n");
    }
    throw new Error("LLM response did not include message content.");
  }

  private parseJson<T>(value: string): T {
    const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1] ?? value;
    const firstBrace = candidate.indexOf("{");
    const firstBracket = candidate.indexOf("[");
    const start = [firstBrace, firstBracket].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
    const cleaned = candidate.slice(start).trim();
    return JSON.parse(cleaned) as T;
  }

  private async chatForJson<T>(messages: Message[], temperature = 0.2): Promise<T> {
    let lastError: unknown;
    let prompt = messages;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const content = await this.chat(prompt, temperature);
      try {
        return this.parseJson<T>(content);
      } catch (error) {
        lastError = error;
        prompt = [
          ...messages,
          {
            role: "user",
            content:
              "Your previous response was not valid JSON. Reply again using only strict JSON with no markdown fences, explanation, or prose."
          }
        ];
      }
    }

    throw new Error(`Failed to parse valid JSON from model response: ${String(lastError)}`);
  }

  async evaluateBorderlineSkip(input: {
    diffSummary: string;
    changedFiles: string[];
  }): Promise<SkipDecision> {
    return await this.chatForJson<SkipDecision>(
      [
        {
          role: "system",
          content:
            "You are deciding whether a pull request is so obvious that it should skip a comprehension quiz. Favor skipping only for low-risk, clearly obvious changes. Return strict JSON."
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
              diffSummary: truncate(input.diffSummary, 5000)
            },
            null,
            2
          )
        }
      ],
      0
    );
  }

  async generateQuiz(input: {
    repoContext: RepoContext;
    diffSummary: string;
    questionCount: number;
  }): Promise<QuizPayload> {
    return await this.chatForJson<QuizPayload>(
      [
        {
          role: "system",
          content:
            "You generate strict JSON for a merge-gating PR quiz. Use repository context only as background. Every question must be answerable from the diff and changed behavior only. Prefer behavior and risk questions, but include implementation detail if it helps prove understanding. Multiple choice only."
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
              diffSummary: truncate(input.diffSummary, 14000)
            },
            null,
            2
          )
        }
      ],
      0.2
    );
  }

  async validateQuiz(input: { quiz: QuizPayload; repoContext: RepoContext; diffSummary: string }): Promise<QuizValidation> {
    return await this.chatForJson<QuizValidation>(
      [
        {
          role: "system",
          content:
            "You validate a PR quiz for grounding and quality. Reject questions that depend on unchanged code knowledge, are ambiguous, or have weak distractors. Return strict JSON."
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
              diffSummary: truncate(input.diffSummary, 10000)
            },
            null,
            2
          )
        }
      ],
      0
    );
  }
}
