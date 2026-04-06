/**
 * LangFuse integration for prompt management, tracing, and feedback scoring.
 *
 * Environment variables:
 *   LANGFUSE_SECRET_KEY  — server-side secret key
 *   LANGFUSE_PUBLIC_KEY  — public key (also used client-side for feedback)
 *   LANGFUSE_BASE_URL    — defaults to https://cloud.langfuse.com
 *
 * When credentials are missing the module degrades gracefully: prompts fall
 * back to hardcoded defaults, tracing becomes a no-op, and feedback calls
 * are silently ignored.
 */

import { Langfuse } from "langfuse";
import { logInfo } from "./log.js";

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

let _client: Langfuse | undefined;

function isConfigured(): boolean {
  return Boolean(process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY);
}

function getClient(): Langfuse | undefined {
  if (!isConfigured()) return undefined;

  if (!_client) {
    _client = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      baseUrl: process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com"
    });
  }

  return _client;
}

/** Public key + base URL exposed to the client-side for the feedback widget. */
export function getLangfusePublicConfig(): { publicKey: string; baseUrl: string } | undefined {
  if (!isConfigured()) return undefined;
  return {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    baseUrl: process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com"
  };
}

// ---------------------------------------------------------------------------
// Prompt Management
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/**
 * Fetch a chat prompt from LangFuse. Returns compiled messages with variables
 * interpolated, or `undefined` if LangFuse is unavailable so the caller can
 * fall back to hardcoded prompts.
 */
export async function getChatPrompt(
  name: string,
  variables: Record<string, string>
): Promise<{ messages: ChatMessage[]; promptMeta: Record<string, unknown> } | undefined> {
  const client = getClient();
  if (!client) return undefined;

  try {
    const prompt = await client.getPrompt(name, undefined, {
      type: "chat",
      cacheTtlSeconds: 300
    });

    const compiled = prompt.compile(variables);

    return {
      messages: (compiled as Array<{ role: string; content: string }>).map((m) => ({
        role: m.role as "system" | "user",
        content: m.content
      })),
      promptMeta: prompt.toJSON() as unknown as Record<string, unknown>
    };
  } catch (error) {
    logInfo("langfuse.prompt.fetch_failed", { name, error: String(error) });
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Tracing
// ---------------------------------------------------------------------------

export interface TraceContext {
  traceId: string;
  /** Record a generation (LLM call) within this trace. */
  generation(params: GenerationParams): GenerationHandle;
  /** End the trace. Call this when the pipeline is complete. */
  end(output?: unknown): void;
}

export interface GenerationParams {
  name: string;
  model: string;
  input: unknown;
  modelParameters?: Record<string, unknown>;
  promptMeta?: Record<string, unknown>;
}

export interface GenerationHandle {
  /** Update with the LLM response. */
  end(output: unknown, usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }): void;
}

/**
 * Create a new LangFuse trace for a quiz generation pipeline.
 * Returns a lightweight handle; if LangFuse is unavailable the handle is a
 * no-op so callers don't need to branch.
 */
export function createTrace(params: {
  name: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  userId?: string;
}): TraceContext {
  const client = getClient();
  if (!client) return noopTrace();

  const trace = client.trace({
    name: params.name,
    metadata: params.metadata,
    sessionId: params.sessionId,
    userId: params.userId
  });

  return {
    traceId: trace.id,
    generation(gp: GenerationParams): GenerationHandle {
      const gen = trace.generation({
        name: gp.name,
        model: gp.model,
        input: gp.input,
        modelParameters: gp.modelParameters as Record<string, string | number | boolean | string[] | null> | undefined,
        ...(gp.promptMeta
          ? { metadata: { langfusePrompt: JSON.stringify(gp.promptMeta) } }
          : {})
      });

      return {
        end(output: unknown, usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }) {
          gen.end({
            output,
            usage: usage
              ? {
                  input: usage.inputTokens,
                  output: usage.outputTokens,
                  total: usage.totalTokens
                }
              : undefined
          });
        }
      };
    },
    end(output?: unknown) {
      trace.update({ output });
      // Best-effort flush — don't await to avoid blocking the request
      client.flushAsync().catch(() => {});
    }
  };
}

function noopTrace(): TraceContext {
  return {
    traceId: "",
    generation() {
      return { end() {} };
    },
    end() {}
  };
}

// ---------------------------------------------------------------------------
// Feedback / Scoring
// ---------------------------------------------------------------------------

/**
 * Submit a user feedback score for a trace. Used server-side so we control
 * the secret key. Value: 1 = thumbs up, 0 = thumbs down.
 */
export async function submitFeedbackScore(params: {
  traceId: string;
  value: number;
  comment?: string;
}): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    client.score({
      traceId: params.traceId,
      name: "user-feedback",
      value: params.value,
      comment: params.comment
    });
    await client.flushAsync();
  } catch (error) {
    logInfo("langfuse.score.submit_failed", { traceId: params.traceId, error: String(error) });
  }
}

/**
 * Flush the LangFuse client. Call during server shutdown for clean exit.
 */
export async function shutdownLangfuse(): Promise<void> {
  if (_client) {
    await _client.shutdownAsync();
    _client = undefined;
  }
}
