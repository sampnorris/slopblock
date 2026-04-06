# SlopBlock — Transparency Disclosures

SlopBlock is a GitHub App that generates short quizzes from PR diffs. It sets a commit status check — it does not approve PRs, modify code, or make merge decisions autonomously.

## AI Usage

AI generates quiz questions and validates them. The pass/fail decision is deterministic: the author answers correctly or doesn't. Under the EU AI Act this is a limited-risk system — a developer tool with no autonomous decisions affecting individuals.

## Data Sent to LLM Providers

The LLM provider is user-configured (default: OpenRouter). Organizations can use any OpenAI-compatible endpoint, including self-hosted models.

**Sent:** file paths (up to 120), changed file contents (truncated to 3K chars each), diff patches (truncated, max 14K chars), file metadata (additions/deletions), custom prompts if configured.

**Not sent:** usernames, PR titles/descriptions, commit SHAs, branch names, repo URLs, tokens, or any PII.

## Data Stored

PostgreSQL stores: installation settings (with LLM API key encrypted via AES-256-GCM), quiz sessions (PR metadata, questions, status), and quiz attempts (scores, answers). Diffs, file contents, and patches are transient — never persisted. OAuth tokens are discarded immediately after fetching the user's GitHub login.

## Security

- API keys: AES-256-GCM encrypted at rest, never exposed to clients.
- Sessions: HMAC-SHA256 signed HttpOnly/Secure cookies containing only the GitHub login.
- Webhooks: HMAC-SHA256 verified with timing-safe comparison.
- Authorization: only the PR author can submit quiz answers.

## Data Retention

Completed sessions are deleted after 30 days. Sessions for closed PRs are deleted immediately. Quiz attempts are retained as an audit log. Installation settings persist until manually removed.

## Compliance

Complies with the GitHub Marketplace Developer Agreement. EU AI Act (Arts. 6, 8–17): limited-risk classification, multi-stage validation, documented risk mitigations, human oversight (maintainers control merge), open-source codebase. GDPR: only GitHub login stored; no email/PII; tokens discarded; data erasure via settings UI and automatic cleanup.

SlopBlock does not train models on your code, does not cache code beyond a single request, and does not share data between installations.

Contact: https://github.com/sampnorris/slopblock
