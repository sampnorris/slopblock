import * as github from "@actions/github";
import type { ChangedFile } from "./types.js";

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

export async function upsertCommitStatus(params: {
  octokit: ReturnType<typeof getOctokit>;
  owner: string;
  repo: string;
  headSha: string;
  context: string;
  state: "success" | "failure" | "pending" | "error";
  summary: string;
  detailsUrl?: string;
}): Promise<void> {
  await params.octokit.rest.repos.createCommitStatus({
    owner: params.owner,
    repo: params.repo,
    sha: params.headSha,
    context: params.context,
    state: params.state,
    description: params.summary.slice(0, 140),
    target_url: params.detailsUrl
  });
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
