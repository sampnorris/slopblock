import { SessionStatus } from "@prisma/client";
import { computeQuestionCount, initialSkipDecision } from "../heuristics.js";
import { OpenAICompatibleClient } from "../openai.js";
import { validateQuizPayload } from "../quiz.js";
import type { ChangedFile, QuizPayload, SkipDecision, SlopblockConfig } from "../types.js";
import { summarizePatch } from "../util.js";
import { buildRemoteRepoContext } from "./remote-repo-context.js";
import { renderSessionComment } from "./render.js";
import { getSession, getSessionById, type SessionRecord, upsertSession } from "./session-store.js";
import { listChangedFiles, setCommitStatus, sessionTargetUrl, upsertIssueComment } from "./github-service.js";
import { logInfo } from "./log.js";
import { loadRemoteConfig } from "./remote-config.js";

function diffSummary(files: ChangedFile[]): string {
  return files
    .map((file) => {
      return [
        `file: ${file.filename}`,
        `status: ${file.status}`,
        `additions: ${file.additions}`,
        `deletions: ${file.deletions}`,
        "patch:",
        summarizePatch(file.patch, 40)
      ].join("\n");
    })
    .join("\n\n");
}

function llmClient(config: SlopblockConfig, purpose: "generation" | "validation" | "skip") {
  const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.SLOPBLOCK_API_KEY ?? config.llm.apiKey;
  const baseUrl = process.env.AI_GATEWAY_BASE_URL ?? process.env.SLOPBLOCK_BASE_URL ?? config.llm.baseUrl ?? "https://ai-gateway.vercel.sh/v1";
  const overrideModel = process.env.AI_GATEWAY_MODEL ?? process.env.SLOPBLOCK_MODEL;
  const model =
    overrideModel ??
    (purpose === "generation"
      ? process.env.AI_GATEWAY_GENERATION_MODEL ?? process.env.SLOPBLOCK_GENERATION_MODEL ?? config.llm.generationModel
      : purpose === "validation"
        ? process.env.AI_GATEWAY_VALIDATION_MODEL ?? process.env.SLOPBLOCK_VALIDATION_MODEL ?? config.llm.validationModel
        : process.env.AI_GATEWAY_SKIP_MODEL ?? process.env.SLOPBLOCK_SKIP_MODEL ?? config.llm.skipModel);

  if (!apiKey) {
    throw new Error("Missing AI gateway API key. Set AI_GATEWAY_API_KEY or SLOPBLOCK_API_KEY.");
  }

  return new OpenAICompatibleClient({ apiKey, baseUrl, model });
}

async function maybeSkip(client: OpenAICompatibleClient, heuristic: SkipDecision, files: ChangedFile[]) {
  if (heuristic.outcome === "skip" || heuristic.certainty !== "low") {
    return heuristic;
  }

  return await client.evaluateBorderlineSkip({
    changedFiles: files.map((file) => file.filename),
    diffSummary: diffSummary(files)
  });
}

async function generateValidQuiz(params: {
  generationClient: OpenAICompatibleClient;
  validationClient: OpenAICompatibleClient;
  repoContext: Awaited<ReturnType<typeof buildRemoteRepoContext>>;
  diffSummary: string;
  questionCount: number;
}): Promise<QuizPayload> {
  let feedback: string[] = [];
  let bestQuiz: QuizPayload | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const quiz = await params.generationClient.generateQuiz({
      repoContext: params.repoContext,
      diffSummary: params.diffSummary,
      questionCount: params.questionCount,
      validatorFeedback: feedback
    });
    const localIssues = validateQuizPayload(quiz);
    if (localIssues.length > 0) {
      feedback = localIssues;
      continue;
    }

    bestQuiz = quiz;

    const validation = await params.validationClient.validateQuiz({
      quiz,
      repoContext: params.repoContext,
      diffSummary: params.diffSummary
    });
    if (validation.valid) {
      return quiz;
    }

    feedback = validation.issues;
  }

  if (bestQuiz) {
    logInfo("quiz.generation.using_best_attempt", {
      feedbackIssues: feedback.length,
      questionCount: bestQuiz.questions.length
    });
    return bestQuiz;
  }

  throw new Error(`Quiz generation failed after 3 attempts: ${feedback.join("; ")}`);
}

async function renderAndPersistComment(octokit: any, session: SessionRecord) {
  const base = session.id ? session : await upsertSession(session);
  logInfo("session.comment.render_start", {
    repository: `${base.repositoryOwner}/${base.repositoryName}`,
    pullNumber: base.pullNumber,
    commentId: base.commentId,
    status: base.status,
    currentQuestionIndex: base.currentQuestionIndex
  });
  const body = renderSessionComment(base);
  const commentId = await upsertIssueComment({
    octokit,
    owner: base.repositoryOwner,
    repo: base.repositoryName,
    issueNumber: base.pullNumber,
    commentId: base.commentId,
    body
  });

  const updated = await upsertSession({ ...base, commentId });

  logInfo("session.comment.render_complete", {
    repository: `${updated.repositoryOwner}/${updated.repositoryName}`,
    pullNumber: updated.pullNumber,
    commentId,
    status: updated.status,
    currentQuestionIndex: updated.currentQuestionIndex
  });
  return updated;
}

export async function submitAnswer(params: {
  octokit: any;
  sessionId: string;
  actorLogin: string;
  selectedKey: string;
}): Promise<{ ok: boolean; redirectUrl: string; message?: string }> {
  const session = await getSessionById(params.sessionId);
  if (!session?.quiz) {
    return { ok: false, redirectUrl: process.env.APP_BASE_URL ?? "/", message: "This quiz session no longer exists." };
  }

  if (params.actorLogin !== session.authorLogin) {
    return {
      ok: false,
      redirectUrl: process.env.APP_BASE_URL ?? "/",
      message: "Only the PR author can answer this quiz."
    };
  }

  const question = session.quiz.questions[session.currentQuestionIndex];
  if (!question) {
    return { ok: false, redirectUrl: process.env.APP_BASE_URL ?? "/", message: "This quiz is already complete." };
  }

  const isCorrect = question.correctOption === params.selectedKey;
  logInfo("session.answer.submit", {
    repository: `${session.repositoryOwner}/${session.repositoryName}`,
    pullNumber: session.pullNumber,
    actorLogin: params.actorLogin,
    questionIndex: session.currentQuestionIndex,
    selectedKey: params.selectedKey,
    correctKey: question.correctOption,
    isCorrect
  });

  if (isCorrect) {
    const nextIndex = session.currentQuestionIndex + 1;
    if (nextIndex >= session.quiz.questions.length) {
      const passed = await renderAndPersistComment(params.octokit, {
        ...session,
        status: SessionStatus.passed,
        currentQuestionIndex: session.quiz.questions.length - 1,
        failureMessage: undefined
      });
      await setCommitStatus({
        octokit: params.octokit,
        owner: session.repositoryOwner,
        repo: session.repositoryName,
        sha: session.headSha,
        state: "success",
        description: "PR author passed the slopblock quiz.",
        targetUrl: sessionTargetUrl(passed)
      });
      return { ok: true, redirectUrl: `${process.env.APP_BASE_URL?.replace(/\/$/, "")}/session/${session.id}?result=passed` };
    }

    await renderAndPersistComment(params.octokit, {
      ...session,
      currentQuestionIndex: nextIndex,
      failureMessage: undefined
    });
    await setCommitStatus({
      octokit: params.octokit,
      owner: session.repositoryOwner,
      repo: session.repositoryName,
      sha: session.headSha,
      state: "pending",
      description: `Question ${nextIndex + 1} of ${session.quiz.questions.length} is waiting for the PR author.`,
      targetUrl: sessionTargetUrl(session)
    });
    return { ok: true, redirectUrl: `${process.env.APP_BASE_URL?.replace(/\/$/, "")}/session/${session.id}?result=correct` };
  }

  await renderAndPersistComment(params.octokit, {
    ...session,
    failureMessage: "That answer does not match the changed behavior. Try again."
  });
  await setCommitStatus({
    octokit: params.octokit,
    owner: session.repositoryOwner,
    repo: session.repositoryName,
    sha: session.headSha,
    state: "pending",
    description: `Question ${session.currentQuestionIndex + 1} still needs a correct answer.`,
    targetUrl: sessionTargetUrl(session)
  });
  return { ok: false, redirectUrl: `${process.env.APP_BASE_URL?.replace(/\/$/, "")}/session/${session.id}?result=incorrect` };
}

export async function handlePullRequestWebhook(octokit: any, payload: any): Promise<void> {
  logInfo("pull_request.handle.start", {
    action: payload.action,
    repository: payload.repository?.full_name,
    pullNumber: payload.pull_request?.number,
    draft: payload.pull_request?.draft,
    headSha: payload.pull_request?.head?.sha
  });
  if (!["opened", "reopened", "ready_for_review", "synchronize"].includes(payload.action)) {
    logInfo("pull_request.handle.ignored_action", {
      action: payload.action,
      repository: payload.repository?.full_name,
      pullNumber: payload.pull_request?.number
    });
    return;
  }

  const pr = payload.pull_request;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const headSha = pr.head.sha;
  logInfo("pull_request.config.load_start", { repository: `${owner}/${repo}`, pullNumber: pr.number, headSha });
  const config = await loadRemoteConfig(octokit, owner, repo, headSha);
  logInfo("pull_request.config.load_complete", { repository: `${owner}/${repo}`, pullNumber: pr.number });

  if (pr.draft) {
    logInfo("pull_request.handle.ignored_draft", { repository: `${owner}/${repo}`, pullNumber: pr.number });
    return;
  }

  if (config.heuristics.skipBots && pr.user?.type === "Bot") {
    await setCommitStatus({
      octokit,
      owner,
      repo,
      sha: headSha,
      state: "success",
      description: "Bot-authored pull request skipped by configuration."
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
      description: "Fork pull requests are skipped by configuration."
    });
    return;
  }

  logInfo("pull_request.files.list_start", { repository: `${owner}/${repo}`, pullNumber: pr.number });
  const files = await listChangedFiles(octokit, owner, repo, pr.number);
  logInfo("pull_request.files.list_complete", { repository: `${owner}/${repo}`, pullNumber: pr.number, fileCount: files.length });
  const skipClient = llmClient(config, "skip");
  const skipDecision = await maybeSkip(skipClient, initialSkipDecision(files, config), files);
  logInfo("pull_request.skip.decision", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
    outcome: skipDecision.outcome,
    certainty: skipDecision.certainty,
    reason: skipDecision.reason
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
    summary: undefined,
    skipReason: undefined,
    failureMessage: undefined,
    quiz: undefined,
    commentId: undefined
  };

  if (skipDecision.outcome === "skip") {
    const session = await renderAndPersistComment(octokit, {
      ...baseSession,
      status: SessionStatus.skipped,
      skipReason: skipDecision.reason
    });
    await setCommitStatus({
      octokit,
      owner,
      repo,
      sha: headSha,
      state: "success",
      description: skipDecision.reason,
      targetUrl: sessionTargetUrl(session)
    });
    return;
  }

  logInfo("pull_request.status.pending_generation", { repository: `${owner}/${repo}`, pullNumber: pr.number, headSha });
  await setCommitStatus({
    octokit,
    owner,
    repo,
    sha: headSha,
    state: "pending",
    description: "Generating diff-grounded quiz."
  });

  logInfo("pull_request.context.build_start", { repository: `${owner}/${repo}`, pullNumber: pr.number });
  const repoContext = await buildRemoteRepoContext(octokit, owner, repo, headSha, files, config);
  logInfo("pull_request.context.build_complete", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
    repoMapEntries: repoContext.repoMap.length,
    changedFiles: repoContext.changedFileContexts.length
  });
  logInfo("pull_request.quiz.generate_start", { repository: `${owner}/${repo}`, pullNumber: pr.number });
  const quiz = await generateValidQuiz({
    generationClient: llmClient(config, "generation"),
    validationClient: llmClient(config, "validation"),
    repoContext,
    diffSummary: diffSummary(files),
    questionCount: computeQuestionCount(files, config)
  });
  logInfo("pull_request.quiz.generate_complete", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
    questionCount: quiz.questions.length
  });

  logInfo("pull_request.session.lookup_start", { repository: `${owner}/${repo}`, pullNumber: pr.number });
  const existing = await getSession(owner, repo, pr.number);
  logInfo("pull_request.session.lookup_complete", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
    foundExisting: Boolean(existing)
  });
  const session = await renderAndPersistComment(octokit, {
    ...baseSession,
    commentId: existing?.commentId,
    questionCount: quiz.questions.length,
    summary: quiz.summary,
    quiz
  });

  logInfo("pull_request.status.pending_question", {
    repository: `${owner}/${repo}`,
    pullNumber: pr.number,
    questionCount: quiz.questions.length,
    commentId: session.commentId
  });
  await setCommitStatus({
    octokit,
    owner,
    repo,
    sha: headSha,
    state: "pending",
    description: `Question 1 of ${quiz.questions.length} is waiting for the PR author.`,
    targetUrl: sessionTargetUrl(session)
  });
  logInfo("pull_request.handle.complete", { repository: `${owner}/${repo}`, pullNumber: pr.number });
}
