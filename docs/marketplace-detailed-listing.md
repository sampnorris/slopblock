# Detailed Marketplace Listing

<!-- Everything from Capabilities down. Must be under 2,000 characters total. -->

## Capabilities

- **Diff-grounded quizzes** — Generates 2–5 multiple-choice questions from the actual PR diff, not generic trivia.
- **Two-model validation** — A second AI model reviews every quiz for accuracy before it reaches the author.
- **Smart skip heuristics** — Auto-skips docs, tests, lockfiles, formatting, and tiny changes.
- **Required status check** — Blocks merges via a `slopblock` commit status until the quiz is passed.
- **Risk-aware scaling** — Auth, API, migration, and CI changes trigger more questions.

## Benefits

- **Stop rubber-stamped AI code:** Prove comprehension before merging Copilot/Cursor-generated PRs.
- **Low noise:** Quizzes only appear when they matter.
- **Any LLM provider:** OpenRouter one-click or any OpenAI-compatible API key.

## Getting Started

**Pricing:**
- **Personal accounts:** Free forever.
- **Organizations:** Check GitHub Marketplace for pricing.
- **Open source:** Contact us for exceptions.

**Setup:**
1. Install SlopBlock from the GitHub Marketplace.
2. Sign in to the settings dashboard and connect an LLM provider.
3. Open a PR — SlopBlock posts a quiz link. Pass it to unblock the merge.

## Example Prompts

Trigger manually with a PR comment:
- `/quiz` — Generate or regenerate a quiz on any open PR.

Example quiz questions:
- "What does the new `validateSession()` guard do when the token is expired?"
- "Which edge case is NOT handled by the updated retry logic?"
- "What is the risk if this migration runs against production with existing rows?"

## How It Works

1. PR opened → SlopBlock reads the diff.
2. Trivial changes auto-skipped. Non-trivial changes get a quiz.
3. Author clicks the link, signs in, answers questions one at a time.
4. Pass → merge unblocked. Miss → retry per your team's policy.
