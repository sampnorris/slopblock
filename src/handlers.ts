import * as core from "@actions/core";
import * as github from "@actions/github";
import { loadConfig } from "./config.js";
import { buildQuizComment, gradeAnswers, parseAnswers, parseStateFromComment } from "./comment-state.js";
import { getOctokit, listChangedFiles, upsertCheckRun, upsertManagedComment } from "./github-api.js";
import { computeQuestionCount, initialSkipDecision } from "./heuristics.js";
import { OpenAICompatibleClient } from "./openai.js";
import { buildRepoContext } from "./repo-context.js";
import type { ChangedFile, QuizPayload, SkipDecision, SlopblockConfig, SlopblockState } from "./types.js";
import { summarizePatch } from "./util.js";

const MARKER = "slopblock:state";

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
    await upsertCheckRun({
      octokit,
      owner,
      repo,
      headSha,
      checkName: config.checkName,
      conclusion: "neutral",
      summary: "Pull request is still in draft mode."
    });
    return "draft";
  }

  if (config.heuristics.skipBots && pr.user?.type === "Bot") {
    await upsertCheckRun({
      octokit,
      owner,
      repo,
      headSha,
      checkName: config.checkName,
      conclusion: "success",
      summary: "Bot-authored pull request skipped by configuration."
    });
    return "skipped-bot";
  }

  if (config.heuristics.skipForkPullRequests && pr.head.repo?.fork) {
    await upsertCheckRun({
      octokit,
      owner,
      repo,
      headSha,
      checkName: config.checkName,
      conclusion: "neutral",
      summary: "Fork pull requests are skipped by default because quiz secrets are not exposed to forks."
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
    await upsertCheckRun({
      octokit,
      owner,
      repo,
      headSha,
      checkName: config.checkName,
      conclusion: "success",
      summary: skipDecision.reason
    });
    return "skipped";
  }

  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const repoContext = await buildRepoContext(workspace, files, config);
  const diffSummary = buildDiffSummary(files);
  const questionCount = computeQuestionCount(files, config);
  const quiz = await client.generateQuiz({ repoContext, diffSummary, questionCount });
  const validation = await client.validateQuiz({ quiz, repoContext, diffSummary });

  if (!validation.valid) {
    await upsertCheckRun({
      octokit,
      owner,
      repo,
      headSha,
      checkName: config.checkName,
      conclusion: "action_required",
      summary: "Quiz generation failed validation.",
      text: validation.issues.join("\n")
    });
    throw new Error(`Quiz validation failed: ${validation.issues.join("; ")}`);
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
  await upsertCheckRun({
    octokit,
    owner,
    repo,
    headSha,
    checkName: config.checkName,
    conclusion: "action_required",
    summary: `Quiz posted with ${quiz.questions.length} questions. Waiting for the PR author to answer.`
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
    await upsertCheckRun({
      octokit,
      owner,
      repo,
      headSha: pr.head.sha,
      checkName: config.checkName,
      conclusion: "success",
      summary: `Quiz passed on attempt ${state.attempt}.`
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
    await upsertCheckRun({
      octokit,
      owner,
      repo,
      headSha: pr.head.sha,
      checkName: config.checkName,
      conclusion: "failure",
      summary: "Quiz failed. Maintainer rerun required.",
      text: result.failures.join("\n")
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
    await upsertCheckRun({
      octokit,
      owner,
      repo,
      headSha: pr.head.sha,
      checkName: config.checkName,
      conclusion: "failure",
      summary: "Quiz failed. The author may retry the same quiz.",
      text: result.failures.join("\n")
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
  const quiz = await client.generateQuiz({ repoContext, diffSummary, questionCount });
  const validation = await client.validateQuiz({ quiz, repoContext, diffSummary });
  if (!validation.valid) {
    throw new Error(`Regenerated quiz failed validation: ${validation.issues.join("; ")}`);
  }

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
  await upsertCheckRun({
    octokit,
    owner,
    repo,
    headSha: pr.head.sha,
    checkName: config.checkName,
    conclusion: "failure",
    summary: "Quiz failed. A new quiz has been posted.",
    text: result.failures.join("\n")
  });
  return "failed-new-quiz";
}
