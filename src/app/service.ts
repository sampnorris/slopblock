import { SessionStatus } from "@prisma/client";
import { computeQuestionCount, initialSkipDecision } from "../heuristics.js";
import { OpenAICompatibleClient } from "../openai.js";
import { validateQuizPayload } from "../quiz.js";
import type { ChangedFile, QuizPayload, SkipDecision, SlopblockConfig } from "../types.js";
import { summarizePatch } from "../util.js";
import { buildRemoteRepoContext } from "./remote-repo-context.js";
import { renderSessionComment } from "./render.js";
import { reactionIndexForContent } from "./reactions.js";
import { getSession, type SessionRecord, upsertSession } from "./session-store.js";
import { ensureCommentReactions, listChangedFiles, setCommitStatus, sessionTargetUrl, upsertIssueComment, deleteIssueCommentReaction } from "./github-service.js";
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

  throw new Error(`Quiz generation failed after 3 attempts: ${feedback.join("; ")}`);
}

async function renderAndPersistComment(octokit: any, session: SessionRecord) {
  logInfo("session.comment.render_start", {
    repository: `${session.repositoryOwner}/${session.repositoryName}`,
    pullNumber: session.pullNumber,
    commentId: session.commentId,
    status: session.status,
    currentQuestionIndex: session.currentQuestionIndex
  });
  const body = renderSessionComment(session);
  const commentId = await upsertIssueComment({
    octokit,
    owner: session.repositoryOwner,
    repo: session.repositoryName,
    issueNumber: session.pullNumber,
    commentId: session.commentId,
    body
  });

  const updated = await upsertSession({ ...session, commentId });
  const currentQuestion = updated.quiz?.questions[updated.currentQuestionIndex];
  if (currentQuestion) {
    logInfo("session.comment.ensure_reactions", {
      repository: `${updated.repositoryOwner}/${updated.repositoryName}`,
      pullNumber: updated.pullNumber,
      commentId,
      reactionCount: currentQuestion.options.length
    });
    await ensureCommentReactions(octokit, updated.repositoryOwner, updated.repositoryName, commentId, currentQuestion.options.length);
  }

  logInfo("session.comment.render_complete", {
    repository: `${updated.repositoryOwner}/${updated.repositoryName}`,
    pullNumber: updated.pullNumber,
    commentId,
    status: updated.status,
    currentQuestionIndex: updated.currentQuestionIndex
  });
  return updated;
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

export async function handleReactionWebhook(octokit: any, payload: any): Promise<void> {
  logInfo("reaction.handle.start", {
    action: payload.action,
    repository: payload.repository?.full_name,
    pullNumber: payload.issue?.number,
    commentId: payload.comment?.id,
    sender: payload.sender?.login,
    content: payload.reaction?.content
  });
  if (payload.action !== "created" || !payload.issue?.pull_request || !payload.comment) {
    logInfo("reaction.handle.ignored", {
      action: payload.action,
      repository: payload.repository?.full_name,
      pullNumber: payload.issue?.number
    });
    return;
  }

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const pullNumber = payload.issue.number;
  const session = await getSession(owner, repo, pullNumber);
  if (!session?.quiz || !session.commentId || session.commentId !== payload.comment.id) {
    logInfo("reaction.handle.no_matching_session", {
      repository: `${owner}/${repo}`,
      pullNumber,
      commentId: payload.comment.id,
      foundSession: Boolean(session),
      sessionCommentId: session?.commentId
    });
    return;
  }

  if (payload.sender?.login !== session.authorLogin || session.status !== SessionStatus.awaiting_answer) {
    logInfo("reaction.handle.ignored_sender_or_status", {
      repository: `${owner}/${repo}`,
      pullNumber,
      sender: payload.sender?.login,
      authorLogin: session.authorLogin,
      status: session.status
    });
    await deleteIssueCommentReaction(octokit, owner, repo, payload.reaction.id);
    return;
  }

  const question = session.quiz.questions[session.currentQuestionIndex];
  if (!question) {
    logInfo("reaction.handle.no_current_question", {
      repository: `${owner}/${repo}`,
      pullNumber,
      currentQuestionIndex: session.currentQuestionIndex
    });
    await deleteIssueCommentReaction(octokit, owner, repo, payload.reaction.id);
    return;
  }

  const index = reactionIndexForContent(payload.reaction.content);
  if (index < 0 || index >= question.options.length) {
    logInfo("reaction.handle.invalid_reaction", {
      repository: `${owner}/${repo}`,
      pullNumber,
      reaction: payload.reaction.content,
      optionCount: question.options.length
    });
    await deleteIssueCommentReaction(octokit, owner, repo, payload.reaction.id);
    return;
  }

  const selected = question.options[index];
  const isCorrect = selected.key === question.correctOption;
  logInfo("reaction.handle.answer_received", {
    repository: `${owner}/${repo}`,
    pullNumber,
    questionIndex: session.currentQuestionIndex,
    selectedKey: selected.key,
    correctKey: question.correctOption,
    isCorrect
  });

  if (isCorrect) {
    const nextIndex = session.currentQuestionIndex + 1;
    if (nextIndex >= session.quiz.questions.length) {
      const passed = await renderAndPersistComment(octokit, {
        ...session,
        status: SessionStatus.passed,
        currentQuestionIndex: session.quiz.questions.length - 1,
        failureMessage: undefined
      });
      await setCommitStatus({
        octokit,
        owner,
        repo,
        sha: session.headSha,
        state: "success",
        description: "PR author passed the slopblock quiz.",
        targetUrl: sessionTargetUrl(passed)
      });
    } else {
      const updated = await renderAndPersistComment(octokit, {
        ...session,
        currentQuestionIndex: nextIndex,
        failureMessage: undefined
      });
      await setCommitStatus({
        octokit,
        owner,
        repo,
        sha: session.headSha,
        state: "pending",
        description: `Question ${nextIndex + 1} of ${session.quiz.questions.length} is waiting for the PR author.`,
        targetUrl: sessionTargetUrl(updated)
      });
    }
  } else {
    const updated = await renderAndPersistComment(octokit, {
      ...session,
      failureMessage: "That reaction does not match the changed behavior. Try again."
    });
    await setCommitStatus({
      octokit,
      owner,
      repo,
      sha: session.headSha,
      state: "pending",
      description: `Question ${session.currentQuestionIndex + 1} still needs a correct answer.`,
      targetUrl: sessionTargetUrl(updated)
    });
  }

  await deleteIssueCommentReaction(octokit, owner, repo, payload.reaction.id);
}
