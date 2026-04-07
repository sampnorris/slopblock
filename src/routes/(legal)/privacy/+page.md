---
title: Privacy Policy
---

<svelte:head>

  <title>Privacy Policy — SlopBlock</title>
</svelte:head>

# Privacy Policy

**Effective Date:** April 6, 2026
**Last Updated:** April 6, 2026

SlopBlock ("we", "us", "our") is a GitHub App operated by Sam Norris. This Privacy Policy explains what data we collect, how we use it, and your rights regarding that data.

By installing or using SlopBlock, you agree to this Privacy Policy.

---

## 1. Data We Collect

### 1.1 GitHub Account Information

When you sign in to the SlopBlock quiz interface, we request the `read:user` OAuth scope from GitHub. This grants us read-only access to your **public GitHub profile**, specifically your GitHub username. We do not access your email address, repositories, or any other account data through this scope.

Your GitHub username is stored in a signed, HTTP-only session cookie on your browser. We do not store your GitHub OAuth access token — it is used once during sign-in and immediately discarded.

### 1.2 Pull Request and Repository Data

When a pull request is opened on a repository where SlopBlock is installed, we receive webhook events from GitHub and make API calls to process the PR. This includes:

- **PR metadata:** PR number, author username, head commit SHA, draft status, and fork status.
- **Changed file data:** file paths, diff patches, and file contents of changed files (truncated to 3,000 characters per file).
- **Repository file tree:** a list of file paths in the repository (up to 120 paths) for LLM context.
- **Repository configuration:** the `.github/slopblock.yml` file, if present.

PR diffs, file contents, and repository file trees are processed in-memory to generate quiz questions and are **not stored in our database**. They are sent to your configured LLM provider (see Section 3).

### 1.3 Quiz Data

We store the following in our database:

- **Quiz sessions:** repository owner, repository name, PR number, author username, commit SHA, generated quiz questions, and session status. Sessions are deleted when the PR is closed or after 30 days of inactivity.
- **Quiz attempts:** repository owner, repository name, PR number, author username, commit SHA, answers submitted, score, and whether the attempt passed. Quiz attempt records are retained indefinitely for auditing purposes.

### 1.4 Installation Settings

When you configure SlopBlock for your organization or account, we store:

- Your GitHub account or organization login name.
- Your LLM provider configuration (model selections, quiz behavior preferences, custom prompts).
- Your LLM API key, **encrypted at rest** using AES-256-GCM. API keys are never returned to the client or exposed via our API.

### 1.5 Automatically Collected Data

- **Server logs:** Vercel, our hosting provider, collects standard request logs including IP addresses, request paths, and timestamps. We use these for debugging and operational monitoring only.
- **Google Fonts:** We load typefaces from Google Fonts, which may collect your IP address per [Google's Privacy Policy](https://policies.google.com/privacy).

We do not use any third-party analytics, tracking pixels, advertising networks, or fingerprinting technologies.

---

## 2. How We Use Your Data

We use the data we collect solely to operate SlopBlock:

- **Generate and validate quizzes** from PR diffs.
- **Authenticate PR authors** so only the correct person can answer a quiz.
- **Set commit statuses** on GitHub to block or unblock PR merges.
- **Post and update comments** on pull requests with quiz results.
- **Store quiz attempts** for auditing and to support retry logic.
- **Debug and maintain** the service via server logs.

We do not use your data for advertising, profiling, or any purpose unrelated to the operation of SlopBlock.

---

## 3. Data Shared with Third Parties

### 3.1 LLM Providers

To generate and validate quiz questions, we send the following to your configured LLM provider (e.g., OpenRouter or any OpenAI-compatible API):

- Repository file paths.
- Code diffs and changed file contents.
- Custom prompts, if configured.

We **do not** include GitHub usernames, repository names, URLs, or any personal identifiers in LLM prompts. You choose and configure your own LLM provider — we do not control their data handling practices. Please review your LLM provider's privacy policy.

### 3.2 GitHub

SlopBlock communicates with the GitHub API using installation tokens to read PR data, post comments, and set commit statuses. GitHub's handling of this data is governed by [GitHub's Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

### 3.3 Vercel

SlopBlock is hosted on Vercel. Vercel processes requests and may store server logs. See [Vercel's Privacy Policy](https://vercel.com/legal/privacy-policy).

### 3.4 No Sale of Data

We do not sell, rent, or trade your personal data to any third party.

---

## 4. Data Retention

| Data                  | Retention                                                     |
| --------------------- | ------------------------------------------------------------- |
| Quiz sessions         | Deleted when the PR is closed, or after 30 days of inactivity |
| Quiz attempts         | Retained indefinitely                                         |
| Installation settings | Retained until you uninstall the app or clear your API key    |
| Session cookies       | Expire after 30 days                                          |
| Server logs           | Governed by Vercel's retention policies                       |

---

## 5. Data Security

- LLM API keys are encrypted at rest using AES-256-GCM.
- Session cookies are signed with HMAC-SHA256, HTTP-only, Secure, and SameSite=Lax.
- GitHub webhook payloads are verified using HMAC-SHA256 with timing-safe comparison.
- GitHub OAuth tokens are used once and never stored.

---

## 6. Your Rights

- **Access and deletion:** To request a copy of your data or its deletion, contact us at the email below. We will respond within 30 days.
- **Uninstall:** You can uninstall SlopBlock from your GitHub account or organization at any time. Active quiz sessions for your repositories will be deleted when their associated PRs are closed, or by our weekly cleanup process.
- **Clear API key:** You can remove your stored LLM API key at any time from the SlopBlock settings dashboard.

If you are located in the European Economic Area, United Kingdom, or another jurisdiction with applicable data protection laws, you may have additional rights including the right to access, rectify, port, or erase your personal data, and to object to or restrict processing. To exercise these rights, contact us using the information below.

---

## 7. Children's Privacy

SlopBlock is not directed at individuals under the age of 13. We do not knowingly collect personal data from children.

---

## 8. Changes to This Policy

We may update this Privacy Policy from time to time. If we make material changes, we will update the "Last Updated" date at the top of this page. Continued use of SlopBlock after changes constitutes acceptance of the updated policy.

---

## 9. Contact

For questions about this Privacy Policy or to exercise your data rights, contact:

**Sam Norris**
GitHub: [@sampnorris](https://github.com/sampnorris)
Email: [samuel@samscript.dev](mailto:samuel@samscript.dev)
