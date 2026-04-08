import { SessionStatus } from "@prisma/client";
import { computeQuestionCount, initialSkipDecision } from "./heuristics.js";
import { OpenAICompatibleClient, TokenBudgetExceededError, TokenTracker } from "./openai.js";
import { validateQuizPayload } from "./quiz.js";
import type { ChangedFile, QuizPayload, SkipDecision, SlopblockConfig } from "./types.js";
import { summarizePatch } from "./util.js";
import { buildRemoteRepoContext } from "./remote-repo-context.js";
import { renderSessionComment } from "./render.js";
import { deleteSession, getSession, type SessionRecord, upsertSession } from "./session-store.js";
import {
  listChangedFiles,
  setCommitStatus,
  sessionTargetUrl,
  upsertIssueComment,
} from "./github-service.js";
import { logInfo } from "./log.js";
import { loadRemoteConfig } from "./remote-config.js";
import { getSettings } from "./settings-store.js";
import {
  countQuizGenerationsToday,
  FREE_PLAN_DAILY_QUIZ_LIMIT,
  isPaidPlan,
} from "./marketplace-store.js";
import { createQuizAttempt, gradeQuizAnswers } from "./attempt-store.js";
import { createTrace, type TraceContext } from "./langfuse.js";

export class MissingProviderError extends Error {
  constructor() {
    super(
      "No LLM provider configured. Connect OpenRouter or provide an API key and base URL in /settings.",
    );
    this.name = "MissingProviderError";
  }
}

export class MissingModelError extends Error {
  constructor(purpose: "generation" | "validation" | "skip") {
    super(`No ${purpose} model configured. Select one in /settings.`);
    this.name = "MissingModelError";
  }
}

function diffSummary(files: ChangedFile[]): string {
  return files
    .map((file) => {
      return [
        `file: ${file.filename}`,
        `status: ${file.status}`,
        `additions: ${file.additions}`,
        `deletions: ${file.deletions}`,
        "patch:",
        summarizePatch(file.patch, 40),
      ].join("\n");
    })
    .join("\n\n");
}

async function applyInstallationSettings(
  config: SlopblockConfig,
  installationId: number,
): Promise<SlopblockConfig> {
  const settings = await getSettings(String(installationId));
  if (!settings) return config;

  const customSystemPrompt = settings.customSystemPrompt ?? config.customSystemPrompt;
  const customQuizInstructions = settings.customQuizInstructions ?? config.customQuizInstructions;

  return {
    ...config,
    questionCount: {
      min: settings.questionCountMin ?? config.questionCount.min,
      max: settings.questionCountMax ?? config.questionCount.max,
    },
    quizGeneration: {
      maxAttempts: settings.quizGenerationMaxAttempts ?? config.quizGeneration.maxAttempts,
      allowBestEffortFallback:
        settings.allowBestEffortFallback ?? config.quizGeneration.allowBestEffortFallback,
    },
    retryMode: (settings.retryMode as SlopblockConfig["retryMode"]) ?? config.retryMode,
    passRule: {
      ...config.passRule,
      allowedWrongAnswers: Math.max(
        0,
        Math.floor(settings.allowedWrongAnswers ?? config.passRule.allowedWrongAnswers),
      ),
    },
    heuristics: {
      ...config.heuristics,
      skipBots: settings.skipBots ?? config.heuristics.skipBots,
      skipForkPullRequests: settings.skipForks ?? config.heuristics.skipForkPullRequests,
    },
    llm: {
      ...config.llm,
      apiKey: settings.llmApiKey ?? config.llm.apiKey,
      baseUrl: settings.llmBaseUrl ?? config.llm.baseUrl,
      generationModel: settings.llmGenerationModel ?? config.llm.generationModel,
      validationModel: settings.llmValidationModel ?? config.llm.validationModel,
      skipModel: settings.llmSkipModel ?? config.llm.skipModel,
    },
    customSystemPrompt,
    customQuizInstructions,
    maxTokenBudget: settings.maxTokenBudget ?? config.maxTokenBudget,
    tokenBudgetFallback:
      (settings.tokenBudgetFallback as SlopblockConfig["tokenBudgetFallback"]) ??
      config.tokenBudgetFallback,
  };
}

function llmClient(
  config: SlopblockConfig,
  purpose: "generation" | "validation" | "skip",
  trace?: TraceContext,
  tokenTracker?: TokenTracker,
) {
  const apiKey = (config.llm.apiKey ?? process.env.SLOPBLOCK_API_KEY)?.trim();
  const baseUrl = (config.llm.baseUrl ?? process.env.SLOPBLOCK_BASE_URL)?.trim();
  const overrideModel = process.env.SLOPBLOCK_MODEL;
  const model =
    overrideModel ??
    (purpose === "generation"
      ? (process.env.SLOPBLOCK_GENERATION_MODEL ?? config.llm.generationModel)
      : purpose === "validation"
        ? (process.env.SLOPBLOCK_VALIDATION_MODEL ?? config.llm.validationModel)
        : (process.env.SLOPBLOCK_SKIP_MODEL ?? config.llm.skipModel));

  if (!apiKey || !baseUrl) {
    throw new MissingProviderError();
  }

  if (!model?.trim()) {
    throw new MissingModelError(purpose);
  }

  return new OpenAICompatibleClient({ apiKey, baseUrl, model, trace, tokenTracker });
}

function llmModel(config: SlopblockConfig, purpose: "generation" | "validation" | "skip") {
  const overrideModel = process.env.SLOPBLOCK_MODEL;
  const model =
    overrideModel ??
    (purpose === "generation"
      ? (process.env.SLOPBLOCK_GENERATION_MODEL ?? config.llm.generationModel)
      : purpose === "validation"
        ? (process.env.SLOPBLOCK_VALIDATION_MODEL ?? config.llm.validationModel)
        : (process.env.SLOPBLOCK_SKIP_MODEL ?? config.llm.skipModel));

  if (!model?.trim()) {
    throw new MissingModelError(purpose);
  }

  return model;
}

async function maybeSkip(
  client: OpenAICompatibleClient,
  heuristic: SkipDecision,
  files: ChangedFile[],
) {
  if (heuristic.outcome === "skip" || heuristic.certainty !== "low") {
    return heuristic;
  }

  return await client.evaluateBorderlineSkip({
    changedFiles: files.map((file) => file.filename),
    diffSummary: diffSummary(files),
  });
}

async function generateValidQuiz(params: {
  generationClient: OpenAICompatibleClient;
  validationClient: OpenAICompatibleClient;
  repoContext: Awaited<ReturnType<typeof buildRemoteRepoContext>>;
  diffSummary: string;
  questionCount: number;
  maxAttempts: number;
  allowBestEffortFallback: boolean;
  customSystemPrompt?: string;
  customQuizInstructions?: string;
}): Promise<QuizPayload> {
  let feedback: string[] = [];
  let bestQuiz: QuizPayload | undefined;

  for (let attempt = 0; attempt < params.maxAttempts; attempt += 1) {
    try {
      const quiz = await params.generationClient.generateQuiz({
        repoContext: params.repoContext,
        diffSummary: params.diffSummary,
        questionCount: params.questionCount,
        validatorFeedback: feedback,
        customSystemPrompt: params.customSystemPrompt,
        customQuizInstructions: params.customQuizInstructions,
      });
      const localIssues = validateQuizPayload(quiz, params.questionCount);
      if (localIssues.length > 0) {
        feedback = localIssues;
        continue;
      }

      bestQuiz = quiz;

      const validation = await params.validationClient.validateQuiz({
        quiz,
        repoContext: params.repoContext,
        diffSummary: params.diffSummary,
        expectedQuestionCount: params.questionCount,
      });
      if (validation.valid) {
        return quiz;
      }

      feedback = validation.issues;
    } catch (error) {
      // Token budget exceeded mid-generation — use best effort quiz if available
      if (error instanceof TokenBudgetExceededError) {
        logInfo("quiz.generation.token_budget_exceeded", {
          tokensUsed: error.tokensUsed,
          budget: error.budget,
          attempt,
          hasBestQuiz: !!bestQuiz,
        });
        if (bestQuiz) return bestQuiz;
        // Re-throw so the pipeline-level handler can do a graceful pass
        throw error;
      }
      throw error;
    }
  }

  if (bestQuiz && params.allowBestEffortFallback) {
    logInfo("quiz.generation.using_best_attempt", {
      feedbackIssues: feedback.length,
      questionCount: bestQuiz.questions.length,
    });
    return bestQuiz;
  }

  throw new Error(
    `Quiz generation failed after ${params.maxAttempts} attempts: ${feedback.join("; ")}`,
  );
}

async function renderAndPersistComment(octokit: any, session: SessionRecord) {
  const base = session.id ? session : await upsertSession(session);
  logInfo("session.comment.render_start", {
    repository: `${base.repositoryOwner}/${base.repositoryName}`,
    pullNumber: base.pullNumber,
    commentId: base.commentId,
    status: base.status,
    currentQuestionIndex: base.currentQuestionIndex,
  });
  const body = renderSessionComment(base);
  const commentId = await upsertIssueComment({
    octokit,
    owner: base.repositoryOwner,
    repo: base.repositoryName,
    issueNumber: base.pullNumber,
    commentId: base.commentId,
    body,
  });

  const updated = await upsertSession({ ...base, commentId });

  logInfo("session.comment.render_complete", {
    repository: `${updated.repositoryOwner}/${updated.repositoryName}`,
    pullNumber: updated.pullNumber,
    commentId,
    status: updated.status,
    currentQuestionIndex: updated.currentQuestionIndex,
  });
  return updated;
}

export async function markQuizPassed(params: {
  octokit: any;
  session: SessionRecord;
  answers: Record<string, unknown>;
}): Promise<{
  ok: boolean;
  message?: string;
  passed?: boolean;
  correctCount?: number;
  questionCount?: number;
  attemptNumber?: number;
}> {
  const { octokit, session } = params;

  const graded = gradeQuizAnswers(session, params.answers);
  const { attemptNumber } = await createQuizAttempt(session, graded);

  logInfo("session.quiz.submitted", {
    repository: `${session.repositoryOwner}/${session.repositoryName}`,
    pullNumber: session.pullNumber,
    attemptNumber,
    questionCount: graded.questionCount,
    correctCount: graded.correctCount,
    passed: graded.passed,
    authorLogin: session.authorLogin,
  });

  const allowedWrongAnswers = Math.max(0, session.allowedWrongAnswers ?? 0);
  const wrongCount = Math.max(0, graded.questionCount - graded.correctCount);
  const passedWithTolerance = wrongCount <= allowedWrongAnswers;

  if (!graded.passed && !passedWithTolerance) {
    return {
      ok: false,
      passed: false,
      message: `Quiz not passed (${graded.correctCount}/${graded.questionCount} correct). Fix your answers or generate a new quiz.`,
      correctCount: graded.correctCount,
      questionCount: graded.questionCount,
      attemptNumber,
    };
  }

  if (session.status === SessionStatus.passed) {
    return {
      ok: true,
      message: "Already passed.",
      passed: true,
      correctCount: graded.correctCount,
      questionCount: graded.questionCount,
      attemptNumber,
    };
  }

  logInfo("session.quiz.passed", {
    repository: `${session.repositoryOwner}/${session.repositoryName}`,
    pullNumber: session.pullNumber,
  });

  const passed = await renderAndPersistComment(octokit, {
    ...session,
    status: SessionStatus.passed,
    failureMessage: undefined,
  });

  await setCommitStatus({
    octokit,
    owner: session.repositoryOwner,
    repo: session.repositoryName,
    sha: session.headSha,
    state: "success",
    description: "PR author passed the slopblock quiz.",
    targetUrl: sessionTargetUrl(passed),
  });

  return {
    ok: true,
    passed: true,
    correctCount: graded.correctCount,
    questionCount: graded.questionCount,
    attemptNumber,
  };
}

export async function requestNewQuiz(params: {
  octokit: any;
  session: SessionRecord;
}): Promise<{ ok: boolean; message?: string }> {
  const { octokit, session } = params;
  const owner = session.repositoryOwner;
  const repo = session.repositoryName;

  logInfo("session.quiz.retry_new", {
    repository: `${owner}/${repo}`,
    pullNumber: session.pullNumber,
  });

  await setCommitStatus({
    octokit,
    owner,
    repo,
    sha: session.headSha,
    state: "pending",
    description: "Generating new quiz...",
  });

  const trace = createTrace({
    name: "quiz-retry",
    metadata: {
      repository: `${owner}/${repo}`,
      pullNumber: session.pullNumber,
      headSha: session.headSha,
      installationId: session.installationId,
    },
    sessionId: `${owner}/${repo}#${session.pullNumber}`,
    userId: session.authorLogin,
  });

  const repoConfig = await loadRemoteConfig(octokit, owner, repo, session.headSha);
  const config = await applyInstallationSettings(repoConfig, session.installationId);
  const tokenTracker = new TokenTracker(config.maxTokenBudget);
  const files = await listChangedFiles(octokit, owner, repo, session.pullNumber);
  const repoContext = await buildRemoteRepoContext(
    octokit,
    owner,
    repo,
    session.headSha,
    files,
    config,
  );

  let quiz: QuizPayload;
  try {
    quiz = await generateValidQuiz({
      generationClient: llmClient(config, "generation", trace, tokenTracker),
      validationClient: llmClient(config, "validation", trace, tokenTracker),
      repoContext,
      diffSummary: diffSummary(files),
      questionCount: computeQuestionCount(files, config),
      maxAttempts: config.quizGeneration.maxAttempts,
      allowBestEffortFallback: config.quizGeneration.allowBestEffortFallback,
      customSystemPrompt: config.customSystemPrompt,
      customQuizInstructions: config.customQuizInstructions,
    });
  } catch (error) {
    // Stamp the fallback mode on the error so the webhook handler knows
    // whether to pass or fail the PR check.
    if (error instanceof TokenBudgetExceededError) {
      error.fallback = config.tokenBudgetFallback;
    }
    throw error;
  }

  trace.end({ outcome: "quiz_generated", questionCount: quiz.questions.length });

  const updated = await renderAndPersistComment(octokit, {
    ...session,
    status: SessionStatus.awaiting_answer,
    currentQuestionIndex: 0,
    questionCount: quiz.questions.length,
    generationModel: llmModel(config, "generation"),
    validationModel: llmModel(config, "validation"),
    summary: quiz.summary,
    failureMessage: undefined,
    quiz,
    savedAnswers: undefined, // Clear saved answers for the new quiz
    traceId: trace.traceId || undefined,
  });

  await setCommitStatus({
    octokit,
    owner,
    repo,
    sha: session.headSha,
    state: "pending",
    description: `${quiz.questions.length} questions waiting for the PR author.`,
    targetUrl: sessionTargetUrl(updated),
  });

  return { ok: true };
}

export async function handlePullRequestWebhook(octokit: any, payload: any): Promise<void> {
  logInfo("pull_request.handle.start", {
    action: payload.action,
    repository: payload.repository?.full_name,
    pullNumber: payload.pull_request?.number,
    draft: payload.pull_request?.draft,
    headSha: payload.pull_request?.head?.sha,
  });
  const isManualTrigger = payload.action === "quiz_command";
  if (
    !isManualTrigger &&
    !["opened", "reopened", "ready_for_review", "synchronize"].includes(payload.action)
  ) {
    logInfo("pull_request.handle.ignored_action", {
      action: payload.action,
      repository: payload.repository?.full_name,
      pullNumber: payload.pull_request?.number,
    });
    return;
  }

  const pr = payload.pull_request;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const headSha = pr.head.sha;
  logInfo("pull_request.config.load_start", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
    headSha,
  });
  const repoConfig = await loadRemoteConfig(octokit, owner, repo, headSha);
  const config = await applyInstallationSettings(repoConfig, payload.installation.id);
  logInfo("pull_request.config.load_complete", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
  });

  if (pr.draft && !isManualTrigger) {
    logInfo("pull_request.handle.ignored_draft", {
      repository: `${owner}/${repo}`,
      pullNumber: pr.number,
    });
    return;
  }

  // Free plan: enforce daily quiz generation quota
  if (!isManualTrigger) {
    const paid = await isPaidPlan(String(payload.installation.id));
    if (!paid) {
      const generationsToday = await countQuizGenerationsToday(String(payload.installation.id));
      if (generationsToday >= FREE_PLAN_DAILY_QUIZ_LIMIT) {
        logInfo("pull_request.quota_exceeded", {
          repository: `${owner}/${repo}`,
          pullNumber: pr.number,
          generationsToday,
          limit: FREE_PLAN_DAILY_QUIZ_LIMIT,
        });
        const existing = await getSession(owner, repo, pr.number);
        const session = await renderAndPersistComment(octokit, {
          installationId: payload.installation.id,
          repositoryId: payload.repository.id,
          repositoryOwner: owner,
          repositoryName: repo,
          pullNumber: pr.number,
          authorLogin: pr.user.login,
          headSha,
          status: "quota_exceeded" as SessionStatus,
          currentQuestionIndex: 0,
          questionCount: 0,
          retryMode: config.retryMode,
          allowedWrongAnswers: config.passRule.allowedWrongAnswers,
          commentId: existing?.commentId,
        });
        await setCommitStatus({
          octokit,
          owner,
          repo,
          sha: headSha,
          state: "success",
          description: `Free plan limit reached (${FREE_PLAN_DAILY_QUIZ_LIMIT}/day). Upgrade for unlimited quizzes.`,
          targetUrl: sessionTargetUrl(session),
        });
        return;
      }
    }
  }

  if (config.heuristics.skipBots && pr.user?.type === "Bot") {
    await setCommitStatus({
      octokit,
      owner,
      repo,
      sha: headSha,
      state: "success",
      description: "Bot-authored pull request skipped by configuration.",
    });
    return;
  }

  if (config.heuristics.skipForkPullRequests && pr.head.repo?.fork) {
    await setCommitStatus({
      octokit,
      owner,
      repo,
      sha: headSha,
      state: "success",
      description: "Fork pull requests are skipped by configuration.",
    });
    return;
  }

  // Create a LangFuse trace for the entire quiz lifecycle
  const trace = createTrace({
    name: "quiz-pipeline",
    metadata: {
      repository: `${owner}/${repo}`,
      pullNumber: pr.number,
      headSha,
      installationId: payload.installation.id,
    },
    sessionId: `${owner}/${repo}#${pr.number}`,
    userId: pr.user.login,
  });

  // ── Cache hit: reuse existing quiz if headSha hasn't changed ──
  if (!isManualTrigger) {
    const cached = await getSession(owner, repo, pr.number);
    if (
      cached &&
      cached.headSha === headSha &&
      cached.quiz &&
      cached.status === SessionStatus.awaiting_answer
    ) {
      logInfo("pull_request.handle.cache_hit", {
        repository: `${owner}/${repo}`,
        pullNumber: pr.number,
        headSha,
        sessionId: cached.id,
      });
      trace.end({ outcome: "cache_hit", questionCount: cached.questionCount });
      await setCommitStatus({
        octokit,
        owner,
        repo,
        sha: headSha,
        state: "pending",
        description: `${cached.questionCount} questions waiting for the PR author.`,
        targetUrl: sessionTargetUrl(cached),
      });
      return;
    }
  }

  logInfo("pull_request.files.list_start", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
  });
  const files = await listChangedFiles(octokit, owner, repo, pr.number);
  logInfo("pull_request.files.list_complete", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
    fileCount: files.length,
  });
  const skipClient = llmClient(config, "skip", trace);
  const skipDecision = await maybeSkip(skipClient, initialSkipDecision(files, config), files);
  logInfo("pull_request.skip.decision", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
    outcome: skipDecision.outcome,
    certainty: skipDecision.certainty,
    reason: skipDecision.reason,
  });
  const baseSession: SessionRecord = {
    installationId: payload.installation.id,
    repositoryId: payload.repository.id,
    repositoryOwner: owner,
    repositoryName: repo,
    pullNumber: pr.number,
    authorLogin: pr.user.login,
    headSha,
    status: SessionStatus.awaiting_answer,
    currentQuestionIndex: 0,
    questionCount: 0,
    retryMode: config.retryMode,
    allowedWrongAnswers: config.passRule.allowedWrongAnswers,
    generationModel: undefined,
    validationModel: undefined,
    summary: undefined,
    skipReason: undefined,
    failureMessage: undefined,
    quiz: undefined,
    commentId: undefined,
    traceId: trace.traceId || undefined,
  };

  if (skipDecision.outcome === "skip") {
    trace.end({ outcome: "skipped", reason: skipDecision.reason });
    const session = await renderAndPersistComment(octokit, {
      ...baseSession,
      status: SessionStatus.skipped,
      skipReason: skipDecision.reason,
    });
    await setCommitStatus({
      octokit,
      owner,
      repo,
      sha: headSha,
      state: "success",
      description: skipDecision.reason,
      targetUrl: sessionTargetUrl(session),
    });
    return;
  }

  logInfo("pull_request.status.pending_generation", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
    headSha,
  });
  await setCommitStatus({
    octokit,
    owner,
    repo,
    sha: headSha,
    state: "pending",
    description: "Generating diff-grounded quiz.",
  });

  logInfo("pull_request.context.build_start", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
  });
  const repoContext = await buildRemoteRepoContext(octokit, owner, repo, headSha, files, config);
  logInfo("pull_request.context.build_complete", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
    repoMapEntries: repoContext.repoMap.length,
    changedFiles: repoContext.changedFileContexts.length,
  });
  // Create a shared token tracker so the budget applies across all LLM calls
  const tokenTracker = new TokenTracker(config.maxTokenBudget);

  logInfo("pull_request.quiz.generate_start", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
    tokenBudget: config.maxTokenBudget ?? "unlimited",
  });

  let quiz: QuizPayload;
  let budgetExceeded = false;

  try {
    quiz = await generateValidQuiz({
      generationClient: llmClient(config, "generation", trace, tokenTracker),
      validationClient: llmClient(config, "validation", trace, tokenTracker),
      repoContext,
      diffSummary: diffSummary(files),
      questionCount: computeQuestionCount(files, config),
      maxAttempts: config.quizGeneration.maxAttempts,
      allowBestEffortFallback: config.quizGeneration.allowBestEffortFallback,
      customSystemPrompt: config.customSystemPrompt,
      customQuizInstructions: config.customQuizInstructions,
    });
  } catch (error) {
    if (error instanceof TokenBudgetExceededError) {
      const shouldBlock = config.tokenBudgetFallback === "fail";

      logInfo("pull_request.token_budget_exceeded", {
        repository: `${owner}/${repo}`,
        pullNumber: pr.number,
        tokensUsed: error.tokensUsed,
        budget: error.budget,
        fallback: config.tokenBudgetFallback,
      });
      budgetExceeded = true;

      trace.end({
        outcome: "token_budget_exceeded",
        tokensUsed: error.tokensUsed,
        budget: error.budget,
        fallback: config.tokenBudgetFallback,
      });

      const budgetMsg = `Token budget exceeded (${error.tokensUsed.toLocaleString()} / ${error.budget.toLocaleString()} tokens).`;
      const existing = await getSession(owner, repo, pr.number);
      const session = await renderAndPersistComment(octokit, {
        ...baseSession,
        status: shouldBlock ? SessionStatus.failed : SessionStatus.passed,
        commentId: existing?.commentId,
        failureMessage: shouldBlock
          ? `${budgetMsg} Merge blocked because the token budget fallback is set to fail. Increase the budget or change the fallback to pass in settings.`
          : `${budgetMsg} Quiz skipped to avoid excessive charges.`,
      });
      await setCommitStatus({
        octokit,
        owner,
        repo,
        sha: headSha,
        state: shouldBlock ? "failure" : "success",
        description: shouldBlock
          ? `Token budget exceeded (${error.tokensUsed.toLocaleString()}/${error.budget.toLocaleString()}). Merge blocked.`
          : `Token budget exceeded (${error.tokensUsed.toLocaleString()}/${error.budget.toLocaleString()}). Quiz skipped.`,
        targetUrl: sessionTargetUrl(session),
      });
      return;
    }
    throw error;
  }

  logInfo("pull_request.quiz.generate_complete", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
    questionCount: quiz.questions.length,
    tokensUsed: tokenTracker.totalTokens,
  });

  trace.end({
    outcome: budgetExceeded ? "token_budget_exceeded" : "quiz_generated",
    questionCount: quiz.questions.length,
    tokensUsed: tokenTracker.totalTokens,
  });

  logInfo("pull_request.session.lookup_start", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
  });
  const existing = await getSession(owner, repo, pr.number);
  logInfo("pull_request.session.lookup_complete", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
    foundExisting: Boolean(existing),
  });
  const session = await renderAndPersistComment(octokit, {
    ...baseSession,
    commentId: existing?.commentId,
    questionCount: quiz.questions.length,
    generationModel: llmModel(config, "generation"),
    validationModel: llmModel(config, "validation"),
    summary: quiz.summary,
    quiz,
  });

  await setCommitStatus({
    octokit,
    owner,
    repo,
    sha: headSha,
    state: "pending",
    description: `${quiz.questions.length} questions waiting for the PR author.`,
    targetUrl: sessionTargetUrl(session),
  });
  logInfo("pull_request.handle.complete", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
  });
}

/** Minimum seconds between /quiz commands on the same PR. */
const QUIZ_COMMAND_COOLDOWN_SECONDS = 60;

export async function handleQuizCommand(octokit: any, payload: any): Promise<void> {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issueNumber = payload.issue.number;
  const commentAuthor = payload.comment.user.login;

  logInfo("quiz_command.received", {
    repository: `${owner}/${repo}`,
    pullNumber: issueNumber,
    triggeredBy: commentAuthor,
  });

  // ── Rate limit: prevent /quiz spam ──
  const existing = await getSession(owner, repo, issueNumber);
  if (existing?.id) {
    const row = await (
      await import("./db.js")
    ).prisma.pullRequestSession.findUnique({
      where: { id: existing.id },
      select: { updatedAt: true },
    });
    if (row?.updatedAt) {
      const secondsSinceUpdate = (Date.now() - row.updatedAt.getTime()) / 1000;
      if (secondsSinceUpdate < QUIZ_COMMAND_COOLDOWN_SECONDS) {
        logInfo("quiz_command.rate_limited", {
          repository: `${owner}/${repo}`,
          pullNumber: issueNumber,
          secondsSinceUpdate: Math.round(secondsSinceUpdate),
        });
        try {
          await octokit.rest.reactions.createForIssueComment({
            owner,
            repo,
            comment_id: payload.comment.id,
            content: "-1",
          });
        } catch {
          /* best effort */
        }
        return;
      }
    }
  }

  // React to the comment to acknowledge
  try {
    await octokit.rest.reactions.createForIssueComment({
      owner,
      repo,
      comment_id: payload.comment.id,
      content: "eyes",
    });
  } catch {
    /* best effort */
  }

  // Fetch the PR details (issue_comment only gives us issue data)
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: issueNumber,
  });

  // Build a synthetic payload matching what handlePullRequestWebhook expects
  const syntheticPayload = {
    action: "quiz_command",
    pull_request: pr,
    repository: payload.repository,
    installation: payload.installation,
  };

  await handlePullRequestWebhook(octokit, syntheticPayload);

  // React with rocket to indicate completion
  try {
    await octokit.rest.reactions.createForIssueComment({
      owner,
      repo,
      comment_id: payload.comment.id,
      content: "rocket",
    });
  } catch {
    /* best effort */
  }
}

export async function handlePullRequestClosed(payload: any): Promise<void> {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const pullNumber = payload.pull_request.number;

  logInfo("pull_request.closed", {
    repository: `${owner}/${repo}`,
    pullNumber,
    merged: payload.pull_request.merged,
  });

  const deleted = await deleteSession(owner, repo, pullNumber);
  logInfo("pull_request.closed.session_cleanup", {
    repository: `${owner}/${repo}`,
    pullNumber,
    deleted,
  });
}
