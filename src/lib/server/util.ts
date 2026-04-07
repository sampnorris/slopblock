import { readFile } from "node:fs/promises";
import { relative, sep } from "node:path";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isTextPath(path: string): boolean {
  const blocked = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".pdf",
    ".zip",
    ".gz",
    ".woff",
    ".woff2",
  ];
  return !blocked.some((suffix) => path.toLowerCase().endsWith(suffix));
}

export async function safeRead(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

export function pathMatches(path: string, patterns: string[]): boolean {
  const normalized = path.replaceAll("\\", "/");
  return patterns.some((pattern) => {
    if (pattern.endsWith("/")) {
      return normalized.includes(pattern.replace(/^\*\*\//, ""));
    }
    if (pattern.includes("*.")) {
      return normalized.includes(pattern.replace("**/", "").replace("*", ""));
    }
    return normalized === pattern || normalized.endsWith(pattern);
  });
}

export function summarizePatch(patch: string | undefined, maxLines = 20): string {
  if (!patch) {
    return "";
  }
  return patch.split("\n").slice(0, maxLines).join("\n");
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function extractIdentifiers(input: string): string[] {
  const stop = new Set([
    "const",
    "let",
    "var",
    "return",
    "function",
    "class",
    "true",
    "false",
    "null",
    "undefined",
    "import",
    "from",
    "await",
    "async",
    "export",
    "default",
    "type",
    "interface",
    "public",
    "private",
  ]);
  return [
    ...new Set(
      (input.match(/\b[A-Za-z_][A-Za-z0-9_]{2,}\b/g) ?? [])
        .filter((word) => !stop.has(word))
        .slice(0, 40),
    ),
  ];
}

export function base64Json(data: unknown): string {
  return Buffer.from(JSON.stringify(data), "utf8").toString("base64");
}

export function decodeBase64Json<T>(data: string): T {
  return JSON.parse(Buffer.from(data, "base64").toString("utf8")) as T;
}

export function insideWorkspace(path: string, workspace: string): boolean {
  return !relative(workspace, path).startsWith(`..${sep}`);
}

export function truncate(value: string, max = 3000): string {
  return value.length <= max ? value : `${value.slice(0, max)}\n...[truncated]`;
}
