import * as core from "@actions/core";
import * as github from "@actions/github";
import { loadConfig } from "./config.js";
import { buildQuizComment, gradeAnswers, parseAnswers, parseStateFromComment } from "./comment-state.js";
import { getOctokit, listChangedFiles, upsertCommitStatus, upsertManagedComment } from "./github-api.js";
import { computeQuestionCount, initialSkipDecision } from "./heuristics.js";
import { OpenAICompatibleClient } from "./openai.js";
import { validateQuizPayload } from "./quiz.js";
import { buildRepoContext } from "./repo-context.js";
import type { ChangedFile, QuizPayload, SkipDecision, SlopblockConfig, SlopblockState } from "./types.js";
import { summarizePatch } from "./util.js";

const MARKER = "slopblock:state";

function statusTargetUrl(owner: string, repo: string, pullNumber: number): string {
  return `https://github.com/${owner}/${repo}/pull/${pullNumber}`;
}

function requiredString(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required value: ${name}`);
  }
  return value;
}

function llmClient(config: SlopblockConfig, overrides: { apiKey?: string; baseUrl?: string; model?: string }) {
  const apiKey = overrides.apiKey ?? process.env.SLOPBLOCK_API_KEY ?? config.llm.apiKey;
  const baseUrl = overrides.baseUrl ?? process.env.SLOPBLOCK_BASE_URL ?? config.llm.baseUrl ?? "https://api.openai.com/v1";
  const model = overrides.model ?? process.env.SLOPBLOCK_MODEL ?? config.llm.model;
  if (!apiKey) {
    throw new Error("Missing API key. Set the action input or SLOPBLOCK_API_KEY secret.");
  }
  return new OpenAICompatibleClient({ apiKey, baseUrl, model });
}

function buildDiffSummary(files: ChangedFile[]): string {
  return files
    .map((file) => {
      const pieces = [
        `file: ${file.filename}`,
        `status: ${file.status}`,
        `additions: ${file.additions}`,
        `deletions: ${file.deletions}`,
        "patch:",
        summarizePatch(file.patch, 40)
      ];
      return pieces.join("\n");
    })
    .join("\n\n");
}

async function maybeUseBorderlineSkipModel(client: OpenAICompatibleClient, heuristic: SkipDecision, files: ChangedFile[]) {
  if (heuristic.outcome === "skip" || heuristic.certainty !== "low") {
    return heuristic;
  }

  return await client.evaluateBorderlineSkip({
    changedFiles: files.map((file) => file.filename),
    diffSummary: buildDiffSummary(files)
  });
}

function createAwaitingState(params: {
  prNumber: number;
  headSha: string;
  config: SlopblockConfig;
  quiz: QuizPayload;
  previousAttempt?: number;
}): SlopblockState {
  return {
    version: 1,
    prNumber: params.prNumber,
    headSha: params.headSha,
    status: "awaiting_answer",
    attempt: (params.previousAttempt ?? 0) + 1,
    generatedAt: new Date().toISOString(),
    retryMode: params.config.retryMode,
    quiz: params.quiz
  };
}

async function generateValidQuiz(params: {
  client: OpenAICompatibleClient;
  repoContext: Awaited<ReturnType<typeof buildRepoContext>>;
  diffSummary: string;
  questionCount: number;
  maxAttempts?: number;
}): Promise<QuizPayload> {
  const maxAttempts = params.maxAttempts ?? 3;
  let feedback: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const quiz = await params.client.generateQuiz({
      repoContext: params.repoContext,
      diffSummary: params.diffSummary,
      questionCount: params.questionCount,
      validatorFeedback: feedback
    });

    const localValidationIssues = validateQuizPayload(quiz);
    if (localValidationIssues.length > 0) {
      feedback = localValidationIssues;
      continue;
    }

    const validation = await params.client.validateQuiz({
      quiz,
      repoContext: params.repoContext,
      diffSummary: params.diffSummary
    });
    if (validation.valid) {
      return quiz;
    }

    feedback = validation.issues;
  }

  throw new Error(`Quiz generation failed after ${maxAttempts} attempts: ${feedback.join("; ")}`);
}

export async function handlePullRequestEvent(): Promise<string> {
  const token = requiredString("github-token", core.getInput("github-token"));
  const config = loadConfig(core.getInput("config-path") || ".github/slopblock.yml");
  const octokit = getOctokit(token);
  const context = github.context;

  const pr = context.payload.pull_request;
  if (!pr) {
    return "ignored";
  }

  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const headSha = pr.head.sha;

  if (pr.draft) {
    await upsertCommitStatus({
      octokit,
      owner,
      repo,
      headSha,
      context: config.checkName,
      state: "success",
      summary: "Pull request is still in draft mode.",
      detailsUrl: statusTargetUrl(owner, repo, pr.number)
    });
    return "draft";
  }

  if (config.heuristics.skipBots && pr.user?.type === "Bot") {
    await upsertCommitStatus({
      octokit,
      owner,
      repo,
      headSha,
      context: config.checkName,
      state: "success",
      summary: "Bot-authored pull request skipped by configuration.",
      detailsUrl: statusTargetUrl(owner, repo, pr.number)
    });
    return "skipped-bot";
  }

  if (config.heuristics.skipForkPullRequests && pr.head.repo?.fork) {
    await upsertCommitStatus({
      octokit,
      owner,
      repo,
      headSha,
      context: config.checkName,
      state: "success",
      summary: "Fork pull requests are skipped by default because quiz secrets are not exposed to forks.",
      detailsUrl: statusTargetUrl(owner, repo, pr.number)
    });
    return "skipped-fork";
  }

  const files = await listChangedFiles(octokit, owner, repo, pr.number);
  const heuristicDecision = initialSkipDecision(files, config);
  const client = llmClient(config, {
    apiKey: core.getInput("api-key") || undefined,
    baseUrl: core.getInput("base-url") || undefined,
    model: core.getInput("model") || undefined
  });
  const skipDecision = await maybeUseBorderlineSkipModel(client, heuristicDecision, files);

  if (skipDecision.outcome === "skip") {
    const state: SlopblockState = {
      version: 1,
      prNumber: pr.number,
      headSha,
      status: "skipped",
      attempt: 0,
      generatedAt: new Date().toISOString(),
      retryMode: config.retryMode,
      skipReason: skipDecision.reason
    };

    await upsertManagedComment({
      octokit,
      owner,
      repo,
      issueNumber: pr.number,
      marker: MARKER,
      body: buildQuizComment(state)
    });
    await upsertCommitStatus({
      octokit,
      owner,
      repo,
      headSha,
      context: config.checkName,
      state: "success",
      summary: skipDecision.reason,
      detailsUrl: statusTargetUrl(owner, repo, pr.number)
    });
    return "skipped";
  }

  await upsertCommitStatus({
    octokit,
    owner,
    repo,
    headSha,
    context: config.checkName,
    state: "pending",
    summary: "Generating diff-grounded quiz.",
    detailsUrl: statusTargetUrl(owner, repo, pr.number)
  });

  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const repoContext = await buildRepoContext(workspace, files, config);
  const diffSummary = buildDiffSummary(files);
  const questionCount = computeQuestionCount(files, config);
  let quiz: QuizPayload;
  try {
    quiz = await generateValidQuiz({
      client,
      repoContext,
      diffSummary,
      questionCount
    });
  } catch (error) {
    await upsertCommitStatus({
      octokit,
      owner,
      repo,
      headSha,
      context: config.checkName,
      state: "error",
      summary: "Quiz generation failed validation.",
      detailsUrl: statusTargetUrl(owner, repo, pr.number)
    });
    throw error;
  }

  const existing = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: pr.number,
    per_page: 100
  });
  const previousState = existing
    .map((comment) => parseStateFromComment(comment.body ?? ""))
    .find(Boolean);

  const state = createAwaitingState({
    prNumber: pr.number,
    headSha,
    config,
    quiz,
    previousAttempt: previousState?.attempt
  });

  await upsertManagedComment({
    octokit,
    owner,
    repo,
    issueNumber: pr.number,
    marker: MARKER,
    body: buildQuizComment(state)
  });
  await upsertCommitStatus({
    octokit,
    owner,
    repo,
    headSha,
    context: config.checkName,
    state: "pending",
    summary: `Quiz posted with ${quiz.questions.length} questions. Waiting for the PR author to answer.`,
    detailsUrl: statusTargetUrl(owner, repo, pr.number)
  });
  return "quiz-posted";
}

export async function handleIssueCommentEvent(): Promise<string> {
  const token = requiredString("github-token", core.getInput("github-token"));
  const config = loadConfig(core.getInput("config-path") || ".github/slopblock.yml");
  const octokit = getOctokit(token);
  const context = github.context;

  const issue = context.payload.issue;
  const comment = context.payload.comment;
  if (!issue?.pull_request || !comment) {
    return "ignored";
  }

  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const pullNumber = issue.number;
  const answers = parseAnswers(comment.body ?? "");
  if (!answers) {
    return "ignored";
  }

  const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber });
  if (comment.user?.login !== pr.user.login) {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body: "slopblock ignored this answer because only the PR author can respond to the quiz."
    });
    return "ignored-non-author";
  }

  const managed = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: pullNumber,
    per_page: 100
  });
  const sourceComment = managed.find((entry) => (entry.body ?? "").includes(MARKER));
  const state = sourceComment ? parseStateFromComment(sourceComment.body ?? "") : undefined;
  if (!state?.quiz) {
    return "ignored-no-state";
  }

  const result = gradeAnswers(state.quiz, answers);
  if (result.passed) {
    const passedState: SlopblockState = {
      ...state,
      status: "passed",
      failReason: undefined,
      headSha: pr.head.sha
    };
    await upsertManagedComment({
      octokit,
      owner,
      repo,
      issueNumber: pullNumber,
      marker: MARKER,
      body: buildQuizComment(passedState)
    });
    await upsertCommitStatus({
      octokit,
      owner,
      repo,
      headSha: pr.head.sha,
      context: config.checkName,
      state: "success",
      summary: `Quiz passed on attempt ${state.attempt}.`,
      detailsUrl: statusTargetUrl(owner, repo, pullNumber)
    });
    return "passed";
  }

  if (state.retryMode === "maintainer_rerun") {
    const failedState: SlopblockState = {
      ...state,
      status: "failed",
      failReason: `${result.failures.join(" ")} Maintainer rerun required for a new quiz.`,
      headSha: pr.head.sha
    };
    await upsertManagedComment({
      octokit,
      owner,
      repo,
      issueNumber: pullNumber,
      marker: MARKER,
      body: buildQuizComment(failedState)
    });
    await upsertCommitStatus({
      octokit,
      owner,
      repo,
      headSha: pr.head.sha,
      context: config.checkName,
      state: "failure",
      summary: "Quiz failed. Maintainer rerun required.",
      detailsUrl: statusTargetUrl(owner, repo, pullNumber)
    });
    return "failed-maintainer-rerun";
  }

  if (state.retryMode === "same_quiz") {
    const failedState: SlopblockState = {
      ...state,
      status: "failed",
      failReason: result.failures.join(" "),
      headSha: pr.head.sha
    };
    await upsertManagedComment({
      octokit,
      owner,
      repo,
      issueNumber: pullNumber,
      marker: MARKER,
      body: buildQuizComment(failedState)
    });
    await upsertCommitStatus({
      octokit,
      owner,
      repo,
      headSha: pr.head.sha,
      context: config.checkName,
      state: "failure",
      summary: "Quiz failed. The author may retry the same quiz.",
      detailsUrl: statusTargetUrl(owner, repo, pullNumber)
    });
    return "failed-same-quiz";
  }

  const client = llmClient(config, {
    apiKey: core.getInput("api-key") || undefined,
    baseUrl: core.getInput("base-url") || undefined,
    model: core.getInput("model") || undefined
  });
  const files = await listChangedFiles(octokit, owner, repo, pullNumber);
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const repoContext = await buildRepoContext(workspace, files, config);
  const diffSummary = buildDiffSummary(files);
  const questionCount = computeQuestionCount(files, config);
  const quiz = await generateValidQuiz({
    client,
    repoContext,
    diffSummary,
    questionCount
  });

  const retryState = createAwaitingState({
    prNumber: pullNumber,
    headSha: pr.head.sha,
    config,
    quiz,
    previousAttempt: state.attempt
  });
  retryState.status = "failed";
  retryState.failReason = `${result.failures.join(" ")} A new quiz has been generated.`;

  await upsertManagedComment({
    octokit,
    owner,
    repo,
    issueNumber: pullNumber,
    marker: MARKER,
    body: buildQuizComment(retryState)
  });
  await upsertCommitStatus({
    octokit,
    owner,
    repo,
    headSha: pr.head.sha,
    context: config.checkName,
    state: "failure",
    summary: "Quiz failed. A new quiz has been posted.",
    detailsUrl: statusTargetUrl(owner, repo, pullNumber)
  });
  return "failed-new-quiz";
}
