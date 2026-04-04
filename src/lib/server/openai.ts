import type { QuizPayload, QuizValidation, RepoContext, SkipDecision } from "./types.js";
import { normalizeQuizPayload } from "./quiz.js";
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

export class InsufficientCreditsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientCreditsError";
  }
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
      const body = await response.text();
      if (response.status === 402) {
        throw new InsufficientCreditsError(`LLM provider returned 402: insufficient credits. ${body}`);
      }
      throw new Error(`LLM request failed: ${response.status} ${body}`);
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
    validatorFeedback?: string[];
    customSystemPrompt?: string;
    customQuizInstructions?: string;
  }): Promise<QuizPayload> {
    const defaultSystemPrompt =
      "You generate strict JSON for a merge-gating PR quiz. Use repository context only as background. Every question must be answerable from the diff and changed behavior only. Prefer behavior and risk questions, but include implementation detail if it helps prove understanding. Multiple choice only.";

    const systemPrompt = input.customSystemPrompt
      ? `${defaultSystemPrompt}\n\nAdditional instructions from the repository owner:\n${input.customSystemPrompt}`
      : defaultSystemPrompt;

    const baseInstructions = [
      "Ask only about the diff.",
      "Do not ask trivia about unchanged code.",
      "Make distractors plausible.",
      "Use 4 options unless 5 is necessary.",
      "Return JSON with summary and questions.",
      "Each question needs id, prompt, options, correctOption, explanation, diffAnchors, and focus.",
      "options must be an array of objects shaped exactly like {\"key\":\"A\",\"text\":\"option text\"}.",
      "correctOption must be a single option key letter such as A, B, C, D, or E.",
      "diffAnchors should reference changed file paths or changed symbols.",
      "If prior validator feedback is present, fix those issues instead of repeating them."
    ];

    if (input.customQuizInstructions) {
      baseInstructions.push(input.customQuizInstructions);
    }

    const rawQuiz = await this.chatForJson<QuizPayload>(
      [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              instructions: baseInstructions,
              questionCount: input.questionCount,
              repoContext: input.repoContext,
              diffSummary: truncate(input.diffSummary, 14000),
              validatorFeedback: input.validatorFeedback ?? []
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

  async validateQuiz(input: { quiz: QuizPayload; repoContext: RepoContext; diffSummary: string }): Promise<QuizValidation> {
    return await this.chatForJson<QuizValidation>(
      [
        {
          role: "system",
          content:
            "You validate a PR quiz for grounding and quality. Only reject questions that are factually wrong, structurally broken, or completely unrelated to the diff. Minor speculation in distractors is acceptable. Do not reject a quiz for style issues or slight imprecision. Be lenient. Return strict JSON."
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: "Validate this quiz. Mark it valid unless there are serious grounding or structural errors.",
              rules: [
                "Only mark invalid if a question is factually wrong about the diff.",
                "Only mark invalid if a question requires knowledge of completely unchanged code.",
                "Only mark invalid if options are duplicated or structurally broken.",
                "Do NOT reject for minor distractor speculation.",
                "Do NOT reject for slightly imprecise wording.",
                "When in doubt, mark valid."
              ],
              output: {
                valid: true,
                issues: ["only list serious structural or factual errors"]
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
