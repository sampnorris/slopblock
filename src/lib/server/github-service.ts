import type { SessionRecord } from "./session-store.js";
import { REACTION_OPTIONS } from "./reactions.js";

function appBaseUrl(): string | undefined {
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (baseUrl) {
    return baseUrl.replace(/\/$/, "");
  }

  const vercelUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (!vercelUrl) {
    return undefined;
  }

  return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
}

export function sessionAppUrl(session: SessionRecord): string | undefined {
  const baseUrl = appBaseUrl();
  if (!baseUrl || !session.id) {
    return undefined;
  }

  return `${baseUrl}/session/${session.id}`;
}

export async function listChangedFiles(
  octokit: any,
  owner: string,
  repo: string,
  pullNumber: number,
) {
  return await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });
}

export async function setCommitStatus(params: {
  octokit: any;
  owner: string;
  repo: string;
  sha: string;
  state: "success" | "failure" | "pending" | "error";
  description: string;
  context?: string;
  targetUrl?: string;
}) {
  await params.octokit.rest.repos.createCommitStatus({
    owner: params.owner,
    repo: params.repo,
    sha: params.sha,
    state: params.state,
    context: params.context ?? "slopblock",
    description: params.description.slice(0, 140),
    target_url: params.targetUrl,
  });
}

export async function upsertIssueComment(params: {
  octokit: any;
  owner: string;
  repo: string;
  issueNumber: number;
  commentId?: number;
  body: string;
}): Promise<number> {
  if (params.commentId) {
    try {
      await params.octokit.rest.issues.updateComment({
        owner: params.owner,
        repo: params.repo,
        comment_id: params.commentId,
        body: params.body,
      });
      return params.commentId;
    } catch (error: any) {
      if (error.status !== 404) {
        throw error;
      }
      // Comment was deleted; fall through to create a new one.
    }
  }

  const created = await params.octokit.rest.issues.createComment({
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issueNumber,
    body: params.body,
  });
  return created.data.id;
}

export async function ensureCommentReactions(
  octokit: any,
  owner: string,
  repo: string,
  commentId: number,
  count: number,
) {
  for (const reaction of REACTION_OPTIONS.slice(0, count)) {
    try {
      await octokit.rest.reactions.createForIssueComment({
        owner,
        repo,
        comment_id: commentId,
        content: reaction.content,
      });
    } catch {
      // Ignore duplicates and permission quirks.
    }
  }
}

export async function deleteIssueCommentReaction(
  octokit: any,
  owner: string,
  repo: string,
  reactionId: number,
) {
  try {
    await octokit.rest.reactions.deleteForIssueComment({
      owner,
      repo,
      reaction_id: reactionId,
    });
  } catch {
    // Best-effort cleanup only.
  }
}

export function sessionTargetUrl(session: SessionRecord): string {
  return `https://github.com/${session.repositoryOwner}/${session.repositoryName}/pull/${session.pullNumber}`;
}

export function sessionAnswerUrl(session: SessionRecord): string {
  return sessionAppUrl(session) ?? sessionTargetUrl(session);
}
