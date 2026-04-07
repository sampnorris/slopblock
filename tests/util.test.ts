import test from "node:test";
import assert from "node:assert/strict";
import {
  clamp,
  isTextPath,
  pathMatches,
  summarizePatch,
  normalizeWhitespace,
  extractIdentifiers,
  base64Json,
  decodeBase64Json,
  insideWorkspace,
  truncate,
} from "../src/lib/server/util.js";

// --- clamp ---

test("clamp returns value when within range", () => {
  assert.equal(clamp(5, 0, 10), 5);
});

test("clamp pins value to min", () => {
  assert.equal(clamp(-3, 0, 10), 0);
});

test("clamp pins value to max", () => {
  assert.equal(clamp(99, 0, 10), 10);
});

test("clamp handles min === max", () => {
  assert.equal(clamp(5, 3, 3), 3);
});

// --- isTextPath ---

test("isTextPath returns true for source files", () => {
  assert.equal(isTextPath("src/index.ts"), true);
  assert.equal(isTextPath("README.md"), true);
  assert.equal(isTextPath("package.json"), true);
});

test("isTextPath returns false for binary files", () => {
  assert.equal(isTextPath("logo.png"), false);
  assert.equal(isTextPath("photo.jpg"), false);
  assert.equal(isTextPath("font.woff2"), false);
  assert.equal(isTextPath("archive.zip"), false);
});

test("isTextPath is case-insensitive for extensions", () => {
  assert.equal(isTextPath("IMAGE.PNG"), false);
  assert.equal(isTextPath("photo.JPEG"), false);
});

// --- pathMatches ---

test("pathMatches matches exact path", () => {
  assert.equal(pathMatches("src/index.ts", ["src/index.ts"]), true);
});

test("pathMatches matches directory prefix pattern", () => {
  assert.equal(pathMatches("docs/guide/intro.md", ["docs/"]), true);
});

test("pathMatches matches wildcard extension pattern", () => {
  assert.equal(pathMatches("src/foo.test.ts", ["**/*.test."]), true);
});

test("pathMatches returns false for non-matching patterns", () => {
  assert.equal(pathMatches("src/index.ts", ["docs/", "**/*.md"]), false);
});

test("pathMatches normalizes backslashes", () => {
  assert.equal(pathMatches("docs\\guide\\intro.md", ["docs/"]), true);
});

// --- summarizePatch ---

test("summarizePatch returns empty string for undefined", () => {
  assert.equal(summarizePatch(undefined), "");
});

test("summarizePatch returns full patch when short", () => {
  const patch = "@@\n-old\n+new";
  assert.equal(summarizePatch(patch), patch);
});

test("summarizePatch truncates long patches", () => {
  const lines = Array.from({ length: 30 }, (_, i) => `line ${i}`);
  const patch = lines.join("\n");
  const result = summarizePatch(patch, 5);
  assert.equal(result.split("\n").length, 5);
});

// --- normalizeWhitespace ---

test("normalizeWhitespace collapses runs of whitespace", () => {
  assert.equal(normalizeWhitespace("  hello   world  "), "hello world");
});

test("normalizeWhitespace handles tabs and newlines", () => {
  assert.equal(normalizeWhitespace("a\t\nb"), "a b");
});

// --- extractIdentifiers ---

test("extractIdentifiers pulls out variable-like tokens", () => {
  const ids = extractIdentifiers("const myVar = getUser(userId)");
  assert.ok(ids.includes("myVar"));
  assert.ok(ids.includes("getUser"));
  assert.ok(ids.includes("userId"));
});

test("extractIdentifiers filters out JS keywords", () => {
  const ids = extractIdentifiers("const function return class async await");
  assert.equal(ids.length, 0);
});

test("extractIdentifiers ignores short tokens", () => {
  const ids = extractIdentifiers("a ab abc abcd");
  assert.ok(!ids.includes("a"));
  assert.ok(!ids.includes("ab"));
  assert.ok(ids.includes("abc"));
  assert.ok(ids.includes("abcd"));
});

test("extractIdentifiers deduplicates", () => {
  const ids = extractIdentifiers("foo foo foo bar bar");
  assert.equal(ids.filter((id) => id === "foo").length, 1);
});

// --- base64Json / decodeBase64Json ---

test("base64Json and decodeBase64Json round-trip", () => {
  const data = { key: "value", num: 42, nested: { a: true } };
  const encoded = base64Json(data);
  const decoded = decodeBase64Json(encoded);
  assert.deepEqual(decoded, data);
});

test("base64Json encodes to a valid base64 string", () => {
  const encoded = base64Json({ test: true });
  assert.doesNotThrow(() => Buffer.from(encoded, "base64"));
});

// --- insideWorkspace ---

test("insideWorkspace returns true for nested paths", () => {
  assert.equal(insideWorkspace("/workspace/src/file.ts", "/workspace"), true);
});

test("insideWorkspace returns false for paths escaping the workspace", () => {
  assert.equal(insideWorkspace("/other/file.ts", "/workspace"), false);
});

test("insideWorkspace returns true for the workspace root itself", () => {
  assert.equal(insideWorkspace("/workspace", "/workspace"), true);
});

// --- truncate ---

test("truncate returns short strings unchanged", () => {
  assert.equal(truncate("hello", 100), "hello");
});

test("truncate cuts long strings and appends marker", () => {
  const long = "a".repeat(5000);
  const result = truncate(long, 100);
  assert.ok(result.length < long.length);
  assert.match(result, /\.\.\.\[truncated\]/);
});

test("truncate respects default max of 3000", () => {
  const long = "b".repeat(4000);
  const result = truncate(long);
  assert.ok(result.startsWith("b".repeat(3000)));
  assert.match(result, /\.\.\.\[truncated\]/);
});
