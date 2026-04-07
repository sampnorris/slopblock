import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "../src/lib/markdown.js";

test("renderMarkdown wraps plain text in a paragraph", () => {
  assert.equal(renderMarkdown("Hello world"), "<p>Hello world</p>");
});

test("renderMarkdown renders inline code", () => {
  assert.match(renderMarkdown("Use `foo()` here"), /<code>foo\(\)<\/code>/);
});

test("renderMarkdown renders bold text", () => {
  assert.match(renderMarkdown("This is **bold**"), /<strong>bold<\/strong>/);
});

test("renderMarkdown renders italic text", () => {
  assert.match(renderMarkdown("This is *italic*"), /<em>italic<\/em>/);
});

test("renderMarkdown escapes HTML entities", () => {
  const output = renderMarkdown('Use <script> & "quotes"');
  assert.match(output, /&lt;script&gt;/);
  assert.match(output, /&amp;/);
  assert.match(output, /&quot;/);
});

test("renderMarkdown renders unordered lists", () => {
  const output = renderMarkdown("- item one\n- item two\n- item three");
  assert.match(output, /<ul>/);
  assert.match(output, /<li>item one<\/li>/);
  assert.match(output, /<li>item three<\/li>/);
});

test("renderMarkdown renders ordered lists", () => {
  const output = renderMarkdown("1. first\n2. second");
  assert.match(output, /<ol>/);
  assert.match(output, /<li>first<\/li>/);
  assert.match(output, /<li>second<\/li>/);
});

test("renderMarkdown separates multiple paragraphs", () => {
  const output = renderMarkdown("Paragraph one.\n\nParagraph two.");
  assert.match(output, /<p>Paragraph one\.<\/p>/);
  assert.match(output, /<p>Paragraph two\.<\/p>/);
});

test("renderMarkdown handles inline code inside a list", () => {
  const output = renderMarkdown("- Use `foo`\n- Use `bar`");
  assert.match(output, /<li>Use <code>foo<\/code><\/li>/);
});

test("renderMarkdown handles multi-line paragraph with line breaks", () => {
  const output = renderMarkdown("line one\nline two");
  assert.match(output, /line one<br \/>line two/);
});
