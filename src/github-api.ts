import * as github from "@actions/github";
import type { ChangedFile, SlopblockState } from "./types.js";

export function getOctokit(token: string) {
  return github.getOctokit(token);
}

export async function listChangedFiles(octokit: ReturnType<typeof getOctokit>, owner: string, repo: string, pullNumber: number): Promise<ChangedFile[]> {
  return await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100
  });
}

export async function upsertCheckRun(params: {
  octokit: ReturnType<typeof getOctokit>;
  owner: string;
  repo: string;
  headSha: string;
  checkName: string;
  conclusion: "success" | "failure" | "neutral" | "action_required";
  summary: string;
  text?: string;
  detailsUrl?: string;
}): Promise<void> {
  const existing = await params.octokit.rest.checks.listForRef({
    owner: params.owner,
    repo: params.repo,
    ref: params.headSha,
    check_name: params.checkName,
    per_page: 20
  });

  const latest = existing.data.check_runs.find((run) => run.name === params.checkName);
  const payload = {
    owner: params.owner,
    repo: params.repo,
    name: params.checkName,
    head_sha: params.headSha,
    status: "completed" as const,
    conclusion: params.conclusion,
    output: {
      title: params.checkName,
      summary: params.summary,
      text: params.text
    },
    details_url: params.detailsUrl
  };

  if (latest) {
    await params.octokit.rest.checks.update({ check_run_id: latest.id, ...payload });
    return;
  }

  await params.octokit.rest.checks.create(payload);
}

export async function findManagedComment(params: {
  octokit: ReturnType<typeof getOctokit>;
  owner: string;
  repo: string;
  issueNumber: number;
  marker: string;
}) {
  const comments = await params.octokit.paginate(params.octokit.rest.issues.listComments, {
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issueNumber,
    per_page: 100
  });
  return comments.find((comment) => comment.body?.includes(params.marker));
}

export async function upsertManagedComment(params: {
  octokit: ReturnType<typeof getOctokit>;
  owner: string;
  repo: string;
  issueNumber: number;
  marker: string;
  body: string;
}) {
  const existing = await findManagedComment(params);
  if (existing) {
    await params.octokit.rest.issues.updateComment({
      owner: params.owner,
      repo: params.repo,
      comment_id: existing.id,
      body: params.body
    });
    return existing.id;
  }

  const created = await params.octokit.rest.issues.createComment({
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issueNumber,
    body: params.body
  });
  return created.data.id;
}
