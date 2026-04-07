import type { ChangedFile, RepoContext, SlopblockConfig } from "./types.js";
import { extractIdentifiers, isTextPath, truncate } from "./util.js";

function decodeContent(value: string): string {
  return Buffer.from(value, "base64").toString("utf8");
}

// ---------------------------------------------------------------------------
// In-memory LRU cache for repo context keyed by tree SHA + changed file list
// ---------------------------------------------------------------------------

interface CacheEntry {
  context: RepoContext;
  createdAt: number;
}

const CONTEXT_CACHE_MAX = 64;
const CONTEXT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const contextCache = new Map<string, CacheEntry>();

function contextCacheKey(treeSha: string, changedPaths: string[]): string {
  return `${treeSha}:${changedPaths.sort().join(",")}`;
}

function getCachedContext(key: string): RepoContext | undefined {
  const entry = contextCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > CONTEXT_CACHE_TTL_MS) {
    contextCache.delete(key);
    return undefined;
  }
  // Move to end for LRU ordering
  contextCache.delete(key);
  contextCache.set(key, entry);
  return entry.context;
}

function setCachedContext(key: string, context: RepoContext): void {
  // Evict oldest entries if at capacity
  while (contextCache.size >= CONTEXT_CACHE_MAX) {
    const oldest = contextCache.keys().next().value;
    if (oldest !== undefined) contextCache.delete(oldest);
  }
  contextCache.set(key, { context, createdAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Tree + file fetching
// ---------------------------------------------------------------------------

async function fetchTreeShaAndPaths(
  octokit: any,
  owner: string,
  repo: string,
  headSha: string,
  limit: number,
): Promise<{ treeSha: string; paths: string[] }> {
  const commit = await octokit.rest.git.getCommit({ owner, repo, commit_sha: headSha });
  const treeSha = commit.data.tree.sha as string;
  const tree = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: "true",
  });

  const paths = (tree.data.tree ?? [])
    .filter(
      (entry: any) =>
        entry.type === "blob" && typeof entry.path === "string" && isTextPath(entry.path),
    )
    .slice(0, limit)
    .map((entry: any) => entry.path as string);

  return { treeSha, paths };
}

async function fetchFileText(
  octokit: any,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string | undefined> {
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

// ---------------------------------------------------------------------------
// Diff-focused context: extract only changed hunks + surrounding lines
// ---------------------------------------------------------------------------

function extractDiffContext(
  fullContent: string,
  patch: string | undefined,
  surroundingLines = 5,
): string {
  if (!patch || !fullContent) {
    // No patch available (e.g., new file) — fall back to truncated full content
    return truncate(fullContent, 3000);
  }

  const lines = fullContent.split("\n");
  const changedLineNumbers = new Set<number>();

  // Parse hunk headers to find changed line numbers in the new file
  let currentLine = 0;
  for (const patchLine of patch.split("\n")) {
    const hunkMatch = patchLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      currentLine = parseInt(hunkMatch[1], 10) - 1; // 0-indexed
      continue;
    }
    if (patchLine.startsWith("-")) {
      // Removed line — doesn't exist in the new file
      continue;
    }
    if (patchLine.startsWith("+")) {
      changedLineNumbers.add(currentLine);
      currentLine += 1;
    } else {
      // Context line
      currentLine += 1;
    }
  }

  if (changedLineNumbers.size === 0) {
    return truncate(fullContent, 3000);
  }

  // Expand changed lines with surrounding context
  const includedLines = new Set<number>();
  for (const lineNum of changedLineNumbers) {
    for (
      let i = Math.max(0, lineNum - surroundingLines);
      i <= Math.min(lines.length - 1, lineNum + surroundingLines);
      i++
    ) {
      includedLines.add(i);
    }
  }

  // Build output with line numbers, collapsing gaps
  const sortedLines = [...includedLines].sort((a, b) => a - b);
  const chunks: string[] = [];
  let prevLine = -2;

  for (const lineNum of sortedLines) {
    if (lineNum > prevLine + 1) {
      if (chunks.length > 0) {
        chunks.push("  ...");
      }
    }
    const marker = changedLineNumbers.has(lineNum) ? ">" : " ";
    chunks.push(`${marker} ${lineNum + 1}: ${lines[lineNum]}`);
    prevLine = lineNum;
  }

  return chunks.join("\n");
}

// ---------------------------------------------------------------------------
// Related snippets: extract cross-file references from the diff
// ---------------------------------------------------------------------------

function findRelatedSnippets(
  changedFiles: ChangedFile[],
  repoMap: string[],
  allFileContents: Map<string, string>,
  config: SlopblockConfig,
): RepoContext["relatedSnippets"] {
  // Collect identifiers mentioned in the diffs
  const diffIdentifiers = new Set<string>();
  const changedPaths = new Set(changedFiles.map((f) => f.filename));

  for (const file of changedFiles) {
    if (!file.patch) continue;
    // Only look at added/removed lines
    const changedLines = file.patch
      .split("\n")
      .filter((l) => l.startsWith("+") || l.startsWith("-"))
      .filter((l) => !l.startsWith("+++") && !l.startsWith("---"))
      .join("\n");
    for (const id of extractIdentifiers(changedLines)) {
      diffIdentifiers.add(id);
    }
  }

  if (diffIdentifiers.size === 0) return [];

  // Collect import paths referenced in changed files
  const importedPaths = new Set<string>();
  for (const file of changedFiles) {
    const content = allFileContents.get(file.filename);
    if (!content) continue;
    // Match common import patterns: import ... from "path", require("path")
    const importMatches = content.matchAll(
      /(?:from\s+["']([^"']+)["']|require\s*\(\s*["']([^"']+)["']\s*\))/g,
    );
    for (const match of importMatches) {
      const importPath = match[1] || match[2];
      if (importPath && !importPath.startsWith(".")) continue; // skip node_modules
      // Resolve relative import to a repo path candidate
      const dir = file.filename.split("/").slice(0, -1).join("/");
      const resolved = importPath ? resolveImportPath(dir, importPath, repoMap) : undefined;
      if (resolved && !changedPaths.has(resolved)) {
        importedPaths.add(resolved);
      }
    }
  }

  const snippets: RepoContext["relatedSnippets"] = [];
  const maxSnippetFiles = config.contextBudget.maxSnippetFiles;
  const maxSnippetChars = config.contextBudget.maxSnippetChars;
  let totalChars = 0;

  // First: snippets from imported files that contain diff identifiers
  for (const importedPath of importedPaths) {
    if (snippets.length >= maxSnippetFiles) break;
    const content = allFileContents.get(importedPath);
    if (!content) continue;

    const matchingIds = [...diffIdentifiers].filter((id) => content.includes(id));
    if (matchingIds.length === 0) continue;

    const snippet = extractRelevantLines(content, matchingIds, 60);
    if (totalChars + snippet.length > maxSnippetChars) break;

    snippets.push({
      path: importedPath,
      reason: `Imported by changed file; defines: ${matchingIds.slice(0, 5).join(", ")}`,
      snippet,
    });
    totalChars += snippet.length;
  }

  // Second: scan other repo files for identifier references (limited scan)
  const scanCandidates = repoMap
    .filter((p) => !changedPaths.has(p) && !importedPaths.has(p))
    .slice(0, config.contextBudget.maxRepoFiles);

  for (const candidate of scanCandidates) {
    if (snippets.length >= maxSnippetFiles) break;
    const content = allFileContents.get(candidate);
    if (!content) continue;

    const matchingIds = [...diffIdentifiers].filter((id) => content.includes(id));
    if (matchingIds.length < 2) continue; // require multiple identifier matches for non-imports

    const snippet = extractRelevantLines(content, matchingIds, 40);
    if (totalChars + snippet.length > maxSnippetChars) break;

    snippets.push({
      path: candidate,
      reason: `References: ${matchingIds.slice(0, 5).join(", ")}`,
      snippet,
    });
    totalChars += snippet.length;
  }

  return snippets;
}

function resolveImportPath(dir: string, importPath: string, repoMap: string[]): string | undefined {
  // Normalize the import path relative to the importing file's directory
  const parts = dir ? dir.split("/") : [];
  for (const segment of importPath.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment !== ".") parts.push(segment);
  }
  const base = parts.join("/");

  // Try exact match and common extensions
  const extensions = [
    "",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    "/index.ts",
    "/index.js",
    "/index.tsx",
  ];
  for (const ext of extensions) {
    const candidate = base + ext;
    if (repoMap.includes(candidate)) return candidate;
  }
  return undefined;
}

function extractRelevantLines(content: string, identifiers: string[], maxLines: number): string {
  const lines = content.split("\n");
  const relevantLineNumbers = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (identifiers.some((id) => lines[i].includes(id))) {
      // Include the matching line plus 2 lines of context on each side
      for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
        relevantLineNumbers.add(j);
      }
    }
  }

  const sorted = [...relevantLineNumbers].sort((a, b) => a - b).slice(0, maxLines);
  const chunks: string[] = [];
  let prev = -2;

  for (const lineNum of sorted) {
    if (lineNum > prev + 1 && chunks.length > 0) {
      chunks.push("  ...");
    }
    chunks.push(`${lineNum + 1}: ${lines[lineNum]}`);
    prev = lineNum;
  }

  return chunks.join("\n");
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function buildRemoteRepoContext(
  octokit: any,
  owner: string,
  repo: string,
  headSha: string,
  changedFiles: ChangedFile[],
  config: SlopblockConfig,
): Promise<RepoContext> {
  const { treeSha, paths: repoMap } = await fetchTreeShaAndPaths(
    octokit,
    owner,
    repo,
    headSha,
    config.contextBudget.maxRepoMapEntries,
  );

  // Check cache
  const changedPaths = changedFiles.map((f) => f.filename);
  const cacheKey = contextCacheKey(treeSha, changedPaths);
  const cached = getCachedContext(cacheKey);
  if (cached) return cached;

  // Fetch changed file contents (with diff-focused extraction)
  const changedFileContexts: RepoContext["changedFileContexts"] = [];
  const allFileContents = new Map<string, string>();

  for (const file of changedFiles) {
    const content = (await fetchFileText(octokit, owner, repo, file.filename, headSha)) ?? "";
    allFileContents.set(file.filename, content);
    changedFileContexts.push({
      path: file.filename,
      summary: `status=${file.status} additions=${file.additions} deletions=${file.deletions}`,
      content: extractDiffContext(content, file.patch),
    });
  }

  // Fetch a limited set of related files for snippet extraction
  const changedPathSet = new Set(changedPaths);
  const candidatePaths = repoMap
    .filter((p) => !changedPathSet.has(p) && isTextPath(p))
    .slice(0, config.contextBudget.maxRepoFiles);

  // Batch-fetch related file contents (only if we have identifiers to look for)
  const diffHasIdentifiers = changedFiles.some(
    (f) => f.patch && extractIdentifiers(f.patch).length > 0,
  );
  if (diffHasIdentifiers) {
    // Fetch in parallel with concurrency limit
    const CONCURRENCY = 8;
    for (let i = 0; i < candidatePaths.length; i += CONCURRENCY) {
      const batch = candidatePaths.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (p) => {
          const text = await fetchFileText(octokit, owner, repo, p, headSha);
          return [p, text] as const;
        }),
      );
      for (const [p, text] of results) {
        if (text) allFileContents.set(p, text);
      }
    }
  }

  const relatedSnippets = findRelatedSnippets(changedFiles, repoMap, allFileContents, config);

  const context: RepoContext = {
    repoMap,
    changedFileContexts,
    relatedSnippets,
  };

  setCachedContext(cacheKey, context);
  return context;
}
