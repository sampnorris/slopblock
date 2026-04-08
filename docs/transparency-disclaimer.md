# SlopBlock transparency disclosures

SlopBlock is a GitHub App that generates short quizzes from PR diffs. It sets a commit status check. It does not approve PRs, modify code, or make merge decisions on its own.

## AI Usage

AI is used to generate quiz questions and check them. The pass/fail result is deterministic: the author either answers correctly or doesn't. Under the EU AI Act, this is a limited-risk developer tool because it does not make autonomous decisions about individuals.

## Data Sent to LLM Providers

The LLM provider is chosen by the user. OpenRouter is the default. Organizations can use any OpenAI-compatible endpoint, including self-hosted models.

**Sent:** file paths (up to 120), changed file contents (truncated to 3K chars each), diff patches (truncated, max 14K chars), file metadata (additions/deletions), custom prompts if configured.

**Not sent:** usernames, PR titles/descriptions, commit SHAs, branch names, repo URLs, tokens, or any PII.

## Data Stored

PostgreSQL stores installation settings, with the LLM API key encrypted using AES-256-GCM, along with quiz sessions and quiz attempts. Diffs, file contents, and patches are transient and are not persisted. OAuth tokens are discarded immediately after the user's GitHub login is fetched.

## Security

- API keys: AES-256-GCM encrypted at rest, never exposed to clients.
- Sessions: HMAC-SHA256 signed HttpOnly/Secure cookies containing only the GitHub login.
- Webhooks: HMAC-SHA256 verified with timing-safe comparison.
- Authorization: only the PR author can submit quiz answers.

## Data Retention

Completed sessions are deleted after 30 days. Sessions for closed PRs are deleted immediately. Quiz attempts are retained as an audit log. Installation settings persist until manually removed.

## Compliance

SlopBlock is built to comply with the GitHub Marketplace Developer Agreement. Under the EU AI Act (Arts. 6, 8-17), it is treated as a limited-risk system with multi-stage validation, documented mitigations, and human oversight because maintainers still control the merge. For GDPR, SlopBlock stores only the GitHub login, not email addresses or other personal data. Tokens are discarded, and data can be erased through the settings UI or automatic cleanup.

SlopBlock does not train models on your code, does not cache code beyond a single request, and does not share data between installations.

Contact: https://github.com/sampnorris/slopblock
