import type { ChangedFile, RepoContext, SlopblockConfig } from "../types.js";
import { isTextPath, truncate } from "../util.js";

function decodeContent(value: string): string {
  return Buffer.from(value, "base64").toString("utf8");
}

async function fetchTreePaths(octokit: any, owner: string, repo: string, headSha: string, limit: number): Promise<string[]> {
  const commit = await octokit.rest.git.getCommit({ owner, repo, commit_sha: headSha });
  const tree = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: commit.data.tree.sha,
    recursive: "true"
  });

  return (tree.data.tree ?? [])
    .filter((entry: any) => entry.type === "blob" && typeof entry.path === "string" && isTextPath(entry.path))
    .slice(0, limit)
    .map((entry: any) => entry.path as string);
}

async function fetchFileText(octokit: any, owner: string, repo: string, path: string, ref: string): Promise<string | undefined> {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref });
    if (Array.isArray(data) || data.type !== "file" || typeof data.content !== "string") {
      return undefined;
    }
    return decodeContent(data.content);
  } catch {
    return undefined;
  }
}

export async function buildRemoteRepoContext(
  octokit: any,
  owner: string,
  repo: string,
  headSha: string,
  changedFiles: ChangedFile[],
  config: SlopblockConfig
): Promise<RepoContext> {
  const repoMap = await fetchTreePaths(octokit, owner, repo, headSha, config.contextBudget.maxRepoMapEntries);
  const changedFileContexts = [];

  for (const file of changedFiles) {
    const content = (await fetchFileText(octokit, owner, repo, file.filename, headSha)) ?? "";
    changedFileContexts.push({
      path: file.filename,
      summary: `status=${file.status} additions=${file.additions} deletions=${file.deletions}`,
      content: truncate(content, 3000)
    });
  }

  return {
    repoMap,
    changedFileContexts,
    relatedSnippets: []
  };
}
