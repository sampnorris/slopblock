import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type { ChangedFile, RepoContext, SlopblockConfig } from "./types.js";
import { extractIdentifiers, insideWorkspace, isTextPath, safeRead, truncate } from "./util.js";

async function walk(root: string, current: string, files: string[]): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "dist") {
      continue;
    }
    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) {
      await walk(root, fullPath, files);
      continue;
    }
    if (isTextPath(fullPath) && insideWorkspace(fullPath, root)) {
      files.push(fullPath);
    }
  }
}

function buildRepoMap(paths: string[], workspace: string, config: SlopblockConfig): string[] {
  return paths
    .slice(0, config.contextBudget.maxRepoMapEntries)
    .map((path) => relative(workspace, path).replaceAll("\\", "/"));
}

async function gatherChangedFileContexts(workspace: string, changedFiles: ChangedFile[]): Promise<RepoContext["changedFileContexts"]> {
  const contexts: RepoContext["changedFileContexts"] = [];
  for (const file of changedFiles) {
    const fullPath = join(workspace, file.filename);
    const content = (await safeRead(fullPath)) ?? "";
    contexts.push({
      path: file.filename,
      summary: `status=${file.status} additions=${file.additions} deletions=${file.deletions}`,
      content: truncate(content, 3000)
    });
  }
  return contexts;
}

export async function buildRepoContext(workspace: string, changedFiles: ChangedFile[], config: SlopblockConfig): Promise<RepoContext> {
  const allFiles: string[] = [];
  await walk(workspace, workspace, allFiles);
  const limitedFiles = allFiles.slice(0, config.contextBudget.maxRepoFiles);
  const repoMap = buildRepoMap(limitedFiles, workspace, config);
  const changedFileContexts = await gatherChangedFileContexts(workspace, changedFiles);

  const symbols = extractIdentifiers(changedFiles.map((file) => file.patch ?? "").join("\n")).slice(0, 12);
  const relatedSnippets: RepoContext["relatedSnippets"] = [];
  let remainingChars = config.contextBudget.maxSnippetChars;

  for (const filePath of limitedFiles) {
    if (relatedSnippets.length >= config.contextBudget.maxSnippetFiles || remainingChars <= 0) {
      break;
    }
    const content = await safeRead(filePath);
    if (!content) {
      continue;
    }

    const match = symbols.find((symbol) => content.includes(symbol));
    if (!match) {
      continue;
    }

    const index = content.indexOf(match);
    const start = Math.max(0, index - 250);
    const end = Math.min(content.length, index + 350);
    const snippet = truncate(content.slice(start, end), Math.min(remainingChars, 700));
    remainingChars -= snippet.length;
    relatedSnippets.push({
      path: relative(workspace, filePath).replaceAll("\\", "/"),
      reason: `Contains touched symbol ${match}`,
      snippet
    });
  }

  return {
    repoMap,
    changedFileContexts,
    relatedSnippets
  };
}
