import type { QuizPayload, QuizValidation, RepoContext, SkipDecision } from "./types.js";
import type { ToolDefinition } from "./schemas.js";
import type { TraceContext } from "./langfuse.js";
import { getChatPrompt } from "./langfuse.js";
import { skipDecisionTool, quizPayloadTool, quizValidationTool } from "./schemas.js";
import { normalizeQuizPayload } from "./quiz.js";
import { truncate } from "./util.js";

interface ContentBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string | ContentBlock[];
}

/**
 * Wrap a plain message string in the content-block format with a
 * cache_control breakpoint. When sent through OpenRouter to Anthropic
 * models, this enables prompt caching — the provider caches everything
 * up to the breakpoint so repeated calls with the same system prompt
 * only pay input tokens once.
 */
function cacheable(text: string): ContentBlock[] {
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

interface OpenAIClientOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  trace?: TraceContext;
  tokenTracker?: TokenTracker;
}

interface ChatOptions {
  temperature?: number;
  tool?: ToolDefinition;
}

interface ToolCallResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
      tool_calls?: Array<{
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class InsufficientCreditsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

export class TokenBudgetExceededError extends Error {
  public readonly tokensUsed: number;
  public readonly budget: number;
  /** Set by the service layer to control how the webhook handler reports status. */
  public fallback: "pass" | "fail" = "pass";

  constructor(tokensUsed: number, budget: number) {
    super(
      `Token budget exceeded: ${tokensUsed.toLocaleString()} tokens used, budget is ${budget.toLocaleString()}.`,
    );
    this.name = "TokenBudgetExceededError";
    this.tokensUsed = tokensUsed;
    this.budget = budget;
  }
}

/**
 * Tracks cumulative token usage across multiple LLM calls within a single
 * quiz generation pipeline. Shared between generation and validation clients.
 */
export class TokenTracker {
  private _totalTokens = 0;
  private readonly _budget: number | undefined;

  constructor(budget?: number) {
    this._budget = budget && budget > 0 ? budget : undefined;
  }

  get totalTokens(): number {
    return this._totalTokens;
  }
  get budget(): number | undefined {
    return this._budget;
  }
  get hasBudget(): boolean {
    return this._budget !== undefined;
  }

  /** Record tokens from a completed LLM call. Throws if budget is exceeded. */
  record(promptTokens: number, completionTokens: number): void {
    this._totalTokens += promptTokens + completionTokens;
    if (this._budget && this._totalTokens > this._budget) {
      throw new TokenBudgetExceededError(this._totalTokens, this._budget);
    }
  }

  /** Check whether the next call would likely exceed the budget. */
  wouldExceed(estimatedTokens: number): boolean {
    if (!this._budget) return false;
    return this._totalTokens + estimatedTokens > this._budget;
  }
}

export class OpenAICompatibleClient {
  constructor(private readonly options: OpenAIClientOptions) {}

  /**
   * Number of retries for the legacy JSON-from-content fallback path.
   * With tool calling as the primary method this rarely fires, so a
   * single retry is sufficient.
   */
  private readonly maxFallbackAttempts = 2;

  /**
   * Low-level chat completion call. When a tool is provided, includes it in
   * the request with `tool_choice: "auto"` so the model is guided to produce
   * structured output via the tool call.
   */
  private async chat(messages: Message[], opts: ChatOptions = {}): Promise<string> {
    const { temperature = 0.2, tool } = opts;

    const body: Record<string, unknown> = {
      model: this.options.model,
      temperature,
      messages,
    };

    if (tool) {
      body.tools = [tool];
      body.tool_choice = { type: "function", function: { name: tool.function.name } };
    }

    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 402) {
        throw new InsufficientCreditsError(
          `LLM provider returned 402: insufficient credits. ${text}`,
        );
      }
      throw new Error(`LLM request failed: ${response.status} ${text}`);
    }

    const json = (await response.json()) as ToolCallResponse;

    // Record token usage if tracker is available
    const tracker = this.options.tokenTracker;
    if (tracker && json.usage) {
      tracker.record(json.usage.prompt_tokens ?? 0, json.usage.completion_tokens ?? 0);
    }

    const message = json.choices?.[0]?.message;

    // If a tool call was returned, extract the arguments (guaranteed JSON)
    const toolArgs = message?.tool_calls?.[0]?.function?.arguments;
    if (toolArgs) {
      return toolArgs;
    }

    // Fall back to message content (regular completion or tool-unsupported model)
    const content = message?.content;
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content.map((item) => item.text ?? "").join("\n");
    }

    throw new Error("LLM response did not include message content or tool call.");
  }

  /** Lenient JSON parser used as fallback when tool calling is unavailable. */
  private parseJson<T>(value: string): T {
    const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1] ?? value;
    const firstBrace = candidate.indexOf("{");
    const firstBracket = candidate.indexOf("[");
    const start =
      [firstBrace, firstBracket].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
    const cleaned = candidate.slice(start).trim();
    return JSON.parse(cleaned) as T;
  }

  /**
   * Attempt a structured tool call first. If the model doesn't support tools
   * (returns an error or ignores the tool), fall back to the legacy
   * chatForJson approach with prompt-based JSON + retry.
   *
   * When a trace is attached, records the LLM call as a generation span.
   */
  private async chatStructured<T>(
    messages: Message[],
    tool: ToolDefinition,
    temperature = 0.2,
    generationName = "llm-call",
  ): Promise<T> {
    const trace = this.options.trace;
    const gen = trace?.generation({
      name: generationName,
      model: this.options.model,
      input: messages,
      modelParameters: { temperature },
    });

    // First attempt: tool calling
    try {
      const result = await this.chat(messages, { temperature, tool });
      const parsed = JSON.parse(result) as T;
      gen?.end(parsed);
      return parsed;
    } catch (toolError) {
      // If the error is auth/credits related, don't retry as plain JSON
      if (toolError instanceof InsufficientCreditsError) {
        gen?.end({ error: String(toolError) });
        throw toolError;
      }

      // Check if this looks like a tool-support error vs a real failure
      const msg = toolError instanceof Error ? toolError.message : String(toolError);
      const isToolUnsupported =
        msg.includes("tool") ||
        msg.includes("function") ||
        msg.includes("400") ||
        msg.includes("422");

      if (!isToolUnsupported) {
        gen?.end({ error: String(toolError) });
        throw toolError;
      }
    }

    // Fallback: legacy chatForJson with retry loop
    try {
      const result = await this.chatForJson<T>(messages, temperature);
      gen?.end(result);
      return result;
    } catch (error) {
      gen?.end({ error: String(error) });
      throw error;
    }
  }

  /** Legacy JSON-from-content approach with retry on parse failure. */
  private async chatForJson<T>(messages: Message[], temperature = 0.2): Promise<T> {
    let lastError: unknown;
    let prompt = messages;

    for (let attempt = 1; attempt <= this.maxFallbackAttempts; attempt += 1) {
      const content = await this.chat(prompt, { temperature });
      try {
        return this.parseJson<T>(content);
      } catch (error) {
        lastError = error;
        prompt = [
          ...messages,
          {
            role: "user",
            content:
              "Your previous response was not valid JSON. Reply again using only strict JSON with no markdown fences, explanation, or prose.",
          },
        ];
      }
    }

    throw new Error(`Failed to parse valid JSON from model response: ${String(lastError)}`);
  }

  async evaluateBorderlineSkip(input: {
    diffSummary: string;
    changedFiles: string[];
  }): Promise<SkipDecision> {
    const fallbackSystem =
      "You are deciding whether a pull request is so obvious that it should skip a comprehension quiz. Favor skipping only for low-risk, clearly obvious changes. Return strict JSON.";

    const langfusePrompt = await getChatPrompt("borderline-skip", {});
    const systemContent = langfusePrompt?.messages[0]?.content ?? fallbackSystem;

    return await this.chatStructured<SkipDecision>(
      [
        { role: "system", content: cacheable(systemContent) },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: "Decide whether to skip the quiz for this borderline PR.",
              output: {
                outcome: "skip or quiz",
                reason: "one sentence",
                certainty: "high, medium, or low",
              },
              changedFiles: input.changedFiles,
              diffSummary: truncate(input.diffSummary, 5000),
            },
            null,
            2,
          ),
        },
      ],
      skipDecisionTool,
      0,
      "borderline-skip",
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
    const fallbackSystemPrompt =
      "You generate strict JSON for a merge-gating PR quiz. Use repository context only as background. Every question must be answerable from the diff and changed behavior only. Prefer behavior and risk questions, but include implementation detail if it helps prove understanding. Multiple choice only.";

    const langfusePrompt = await getChatPrompt("quiz-generation", {
      customSystemPrompt: input.customSystemPrompt ?? "",
    });
    const baseSystemPrompt = langfusePrompt?.messages[0]?.content ?? fallbackSystemPrompt;

    // If LangFuse didn't handle the custom prompt (e.g. template didn't include the variable),
    // append it manually as a fallback
    const hasCustomInPrompt =
      langfusePrompt &&
      input.customSystemPrompt &&
      baseSystemPrompt.includes(input.customSystemPrompt);
    const systemPrompt =
      !hasCustomInPrompt && input.customSystemPrompt
        ? `${baseSystemPrompt}\n\nAdditional instructions from the repository owner:\n${input.customSystemPrompt}`
        : baseSystemPrompt;

    const baseInstructions = [
      "Ask only about the diff.",
      "Do not ask trivia about unchanged code.",
      "Make distractors plausible.",
      "Use exactly 3 options for every question.",
      "The summary must be a single concise plain-English sentence describing what the PR does. No file names, no code, no markdown formatting. Write it for a human, not a machine.",
      "Write question prompts, option text, and explanations as markdown.",
      "Use inline code markdown for identifiers, symbols, file paths, commands, and literals when relevant.",
      "Return JSON with summary and questions.",
      "Each question needs id, prompt, options, correctOption, explanation, diffAnchors, and focus.",
      'options must be an array of objects shaped exactly like {"key":"A","text":"option text"}.',
      "correctOption must be a single option key letter: A, B, or C.",
      "diffAnchors should reference changed file paths or changed symbols.",
      "If prior validator feedback is present, fix those issues instead of repeating them.",
      "CRITICAL: All three options must be written at the same level of specificity and detail. If the correct answer mentions a specific function name, file, or behavior, the distractors must also reference specific (but wrong) function names, files, or behaviors. Never make the correct answer obviously longer, more detailed, or more concrete than the distractors.",
      "Vary which key (A, B, or C) is the correct answer across questions. Do not default to A.",
    ];

    if (input.customQuizInstructions) {
      baseInstructions.push(input.customQuizInstructions);
    }

    const rawQuiz = await this.chatStructured<QuizPayload>(
      [
        {
          role: "system",
          content: cacheable(systemPrompt),
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              instructions: baseInstructions,
              questionCount: input.questionCount,
              repoContext: input.repoContext,
              diffSummary: truncate(input.diffSummary, 14000),
              validatorFeedback: input.validatorFeedback ?? [],
            },
            null,
            2,
          ),
        },
      ],
      quizPayloadTool,
      0.2,
      "quiz-generation",
    );

    return normalizeQuizPayload(rawQuiz);
  }

  async validateQuiz(input: {
    quiz: QuizPayload;
    repoContext: RepoContext;
    diffSummary: string;
    expectedQuestionCount: number;
  }): Promise<QuizValidation> {
    const fallbackSystem =
      "You validate a PR quiz for grounding and structure. Reject quizzes that are factually wrong, structurally broken, have the wrong number of questions, use the wrong number of options, or are unrelated to the diff. Minor distractor speculation is acceptable. Do not reject for style alone. Return strict JSON.";

    const langfusePrompt = await getChatPrompt("quiz-validation", {});
    const systemContent = langfusePrompt?.messages[0]?.content ?? fallbackSystem;

    return await this.chatStructured<QuizValidation>(
      [
        { role: "system", content: cacheable(systemContent) },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: "Validate this quiz. Mark it valid unless there are serious grounding or structural errors.",
              rules: [
                "The quiz must contain exactly the expected number of questions.",
                "Each question must have exactly 3 options.",
                "Each question must use option keys A, B, and C exactly once.",
                "Each question's correctOption must be one of A, B, or C and must exist in the options list.",
                "Each question must have a non-empty explanation.",
                "Only mark invalid if a question is factually wrong about the diff.",
                "Only mark invalid if a question requires knowledge of completely unchanged code.",
                "Only mark invalid if options are duplicated or structurally broken.",
                "Do NOT reject for minor distractor speculation.",
                "Do NOT reject for slightly imprecise wording.",
                "When in doubt, mark valid.",
              ],
              expectedQuestionCount: input.expectedQuestionCount,
              output: {
                valid: true,
                issues: ["only list serious structural or factual errors"],
              },
              quiz: input.quiz,
              repoContext: input.repoContext,
              diffSummary: truncate(input.diffSummary, 10000),
            },
            null,
            2,
          ),
        },
      ],
      quizValidationTool,
      0,
      "quiz-validation",
    );
  }
}
