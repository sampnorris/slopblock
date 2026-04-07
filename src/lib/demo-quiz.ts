export interface DemoQuestionOption {
  key: string;
  text: string;
}

export interface DemoQuestion {
  id: string;
  prompt: string;
  options: DemoQuestionOption[];
  correctOption: string;
  explanation: string;
  diffAnchors: string[];
}

export const publicDemoQuiz = {
  title: "PR #312: Add per-user rate limiting to the upload endpoint",
  repo: "acme/storage-api",
  repoUrl: "https://github.com/acme/storage-api",
  installUrl: "https://github.com/apps/slopblock-quiz/installations/new",
  summary:
    "Adds a sliding-window rate limiter to the file upload route so each authenticated user is capped at 50 uploads per minute, returning a 429 with a `Retry-After` header when the limit is exceeded.",
  diff: [
    "diff --git a/src/middleware/rateLimit.ts b/src/middleware/rateLimit.ts",
    "new file mode 100644",
    "@@ -0,0 +1,38 @@",
    "+import { Redis } from \"ioredis\";",
    "+",
    "+const redis = new Redis(process.env.REDIS_URL!);",
    "+",
    "+interface RateLimitConfig {",
    "+  windowMs: number;",
    "+  maxRequests: number;",
    "+}",
    "+",
    "+export async function checkRateLimit(",
    "+  userId: string,",
    "+  config: RateLimitConfig,",
    "+): Promise<{ allowed: boolean; retryAfterMs: number }> {",
    "+  const key = `rate:upload:${userId}`;",
    "+  const now = Date.now();",
    "+  const windowStart = now - config.windowMs;",
    "+",
    "+  const pipeline = redis.pipeline();",
    "+  pipeline.zremrangebyscore(key, 0, windowStart);",
    "+  pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);",
    "+  pipeline.zcard(key);",
    "+  pipeline.pexpire(key, config.windowMs);",
    "+  const results = await pipeline.exec();",
    "+",
    "+  const currentCount = (results?.[2]?.[1] as number) ?? 0;",
    "+",
    "+  if (currentCount > config.maxRequests) {",
    "+    const oldest = await redis.zrange(key, 0, 0, \"WITHSCORES\");",
    "+    const oldestTs = oldest?.[1] ? Number(oldest[1]) : now;",
    "+    const retryAfterMs = oldestTs + config.windowMs - now;",
    "+    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1000) };",
    "+  }",
    "+",
    "+  return { allowed: true, retryAfterMs: 0 };",
    "+}",
    "",
    "diff --git a/src/routes/upload.ts b/src/routes/upload.ts",
    "@@ -1,6 +1,8 @@",
    " import { Router } from \"express\";",
    " import { authenticate } from \"../middleware/auth\";",
    "+import { checkRateLimit } from \"../middleware/rateLimit\";",
    " import { handleUpload } from \"../services/storage\";",
    "+",
    " const router = Router();",
    "",
    "@@ -12,6 +14,18 @@",
    " router.post(\"/\", authenticate, async (req, res) => {",
    "+  const { allowed, retryAfterMs } = await checkRateLimit(req.user.id, {",
    "+    windowMs: 60_000,",
    "+    maxRequests: 50,",
    "+  });",
    "+",
    "+  if (!allowed) {",
    "+    const retryAfterSec = Math.ceil(retryAfterMs / 1000);",
    "+    res.set(\"Retry-After\", String(retryAfterSec));",
    "+    return res.status(429).json({",
    "+      error: \"Rate limit exceeded. Try again later.\",",
    "+    });",
    "+  }",
    "+",
    "   const result = await handleUpload(req);",
    "   return res.status(201).json(result);",
    " });",
  ],
  questions: [
    {
      id: "q1",
      prompt:
        "How does the rate limiter track the number of requests a user has made within the window?",
      options: [
        {
          key: "A",
          text: "It increments an atomic Redis counter with `INCR` and sets a TTL equal to the window duration.",
        },
        {
          key: "B",
          text: "It adds a timestamped member to a Redis sorted set, removes expired entries with `ZREMRANGEBYSCORE`, and checks the set size with `ZCARD`.",
        },
        {
          key: "C",
          text: "It appends each request timestamp to a Redis list with `RPUSH` and trims entries older than the window with `LTRIM`.",
        },
      ],
      correctOption: "B",
      explanation:
        "The `checkRateLimit` function uses a Redis sorted set keyed by user ID. It removes entries outside the window with `ZREMRANGEBYSCORE`, adds the current timestamp with `ZADD`, then checks the count with `ZCARD` — all in a single pipeline call.",
      diffAnchors: ["src/middleware/rateLimit.ts", "checkRateLimit"],
    },
    {
      id: "q2",
      prompt:
        "What happens if the rate limiter's Redis pipeline fails or throws an error in the upload route?",
      options: [
        {
          key: "A",
          text: "The upload route catches the error internally and falls back to allowing the request without rate limiting.",
        },
        {
          key: "B",
          text: "The `checkRateLimit` call rejects, and because the route has no try/catch around it, the error propagates as an unhandled 500.",
        },
        {
          key: "C",
          text: "The Redis pipeline silently returns `null` results, causing `checkRateLimit` to return `allowed: false` and block the upload.",
        },
      ],
      correctOption: "B",
      explanation:
        "The upload route calls `await checkRateLimit(...)` without a try/catch. If the Redis pipeline throws, the promise rejection propagates unhandled and the Express error handler returns a 500 to the client.",
      diffAnchors: ["src/routes/upload.ts", "src/middleware/rateLimit.ts"],
    },
    {
      id: "q3",
      prompt:
        "How does the endpoint tell the client when they can retry after being rate-limited?",
      options: [
        {
          key: "A",
          text: "It returns a 429 response with a `Retry-After` header set to the number of seconds until the oldest request in the window expires.",
        },
        {
          key: "B",
          text: "It returns a 429 response with a JSON body containing a `retryAt` ISO timestamp calculated from the server clock.",
        },
        {
          key: "C",
          text: "It returns a 503 response with a `Retry-After` header set to a fixed 60-second cooldown period.",
        },
      ],
      correctOption: "A",
      explanation:
        "When the limit is exceeded, the route converts `retryAfterMs` to seconds, sets the `Retry-After` header, and returns a 429 status. The value is derived from when the oldest tracked request will fall outside the sliding window.",
      diffAnchors: ["src/routes/upload.ts", "Retry-After"],
    },
  ] satisfies DemoQuestion[],
};
