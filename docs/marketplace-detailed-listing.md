# Detailed Marketplace Listing

<!-- Everything from Capabilities down. Must be under 2,000 characters total. -->

## Capabilities

- Builds 2 to 5 multiple-choice questions from the actual PR diff.
- Checks each quiz with a second model before it reaches the author.
- Skips docs, tests, lockfiles, formatting, and other low-signal changes.
- Blocks merges with a required `slopblock` status check until the quiz is passed.
- Asks more questions when a PR touches auth, APIs, migrations, or CI.

## Benefits

- Make sure the author understands the code before it merges.
- Keep noise down by skipping obvious or routine pull requests.
- Use OpenRouter or any OpenAI-compatible provider.

## Getting Started

**Pricing:**

- Personal accounts: free.
- Organizations: see GitHub Marketplace for pricing.
- Open source: contact us if you need an exception.

**Setup:**

1. Install SlopBlock from the GitHub Marketplace.
2. Sign in to the settings dashboard and connect an LLM provider.
3. Open a PR. If the change is worth checking, SlopBlock posts a quiz link. Pass it to unblock the merge.

## Example Prompts

Trigger manually with a PR comment:

- `/quiz` to generate or regenerate a quiz on any open PR.

Example quiz questions:

- "What does the new `validateSession()` guard do when the token is expired?"
- "Which edge case is NOT handled by the updated retry logic?"
- "What is the risk if this migration runs against production with existing rows?"

## How It Works

1. A PR opens and SlopBlock reads the diff.
2. Trivial changes are skipped. Non-trivial changes get a quiz.
3. The author clicks the link, signs in, and answers the questions.
4. Pass the quiz and the merge is unblocked. Miss it and retry based on your team's policy.
