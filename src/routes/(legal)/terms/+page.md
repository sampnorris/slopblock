---
title: Terms of Service
---

<svelte:head>
  <title>Terms of Service — SlopBlock</title>
</svelte:head>

# Terms of Service

**Effective Date:** April 6, 2026
**Last Updated:** April 6, 2026 (rev. 2 — added token usage responsibility)

These Terms of Service ("Terms") govern your use of SlopBlock, a GitHub App operated by Sam Norris ("we", "us", "our"). By installing or using SlopBlock, you agree to these Terms.

---

## 1. Description of Service

SlopBlock is a GitHub App that generates AI-powered comprehension quizzes on pull request diffs and gates merges behind a required status check. The service reads code changes, sends them to a configured LLM provider, and presents quiz questions to the PR author.

---

## 2. Eligibility

You must be at least 13 years of age and have a valid GitHub account to use SlopBlock. If you are using SlopBlock on behalf of an organization, you represent that you have authority to bind that organization to these Terms.

---

## 3. Accounts and Access

### 3.1 GitHub App Installation

SlopBlock requires installation as a GitHub App on your repository or organization. By installing, you grant SlopBlock the following GitHub permissions:

- **Contents (read):** to fetch file trees, file contents, and configuration files.
- **Pull requests (read/write):** to read PR data and changed files.
- **Issues (read/write):** to create and update comments on pull requests.
- **Commit statuses (write):** to set the `slopblock` status check.
- **Metadata (read):** standard GitHub App requirement.

You may revoke these permissions at any time by uninstalling the app.

### 3.2 LLM Provider Configuration

SlopBlock requires access to an LLM provider (e.g., OpenRouter or any OpenAI-compatible API) to function. You are responsible for:

- Providing and maintaining your own LLM API key.
- Complying with your LLM provider's terms of service and usage policies.
- **All costs incurred from LLM API usage, including token consumption charges.**
- Setting and maintaining appropriate billing caps, spending limits, or usage alerts with your LLM provider.

We encrypt your API key at rest but are not responsible for charges, rate limits, or policy violations on your LLM provider account.

### 3.3 Token Usage and Billing Responsibility

**You are solely responsible for all LLM token usage and associated costs incurred through your use of SlopBlock.** Each quiz generation sends code diffs, file paths, repository context, and related data to your configured LLM provider, consuming tokens on your account. The volume of tokens consumed depends on factors including but not limited to:

- The size of pull request diffs and the number of changed files.
- The number of quiz questions configured.
- The number of generation and validation attempts configured.
- The models you select (different models have different token pricing).
- The frequency of pull requests in your repositories.

**We strongly recommend that you set a billing cap or spending limit with your LLM provider before enabling SlopBlock.** While SlopBlock includes built-in stopgaps to limit unnecessary usage (such as skip heuristics for trivial changes, context size budgets, and configurable generation attempt limits), these safeguards do not guarantee any particular level of token consumption, and we make no representations about the cost of operating the service on your repositories.

**SlopBlock is not responsible for excessive, unexpected, or runaway token usage or charges under any circumstances**, including but not limited to: high-volume repositories, misconfigured settings, LLM provider pricing changes, bugs in the service, or any other cause.

---

## 4. Pricing and Payment

- **Personal accounts:** SlopBlock is free for personal GitHub accounts.
- **Organizations:** See the [GitHub Marketplace listing](https://github.com/marketplace/slopblock-quiz) for current organization pricing.
- **Open source projects:** Contact us for exceptions.

Pricing is subject to change. We will notify existing users of material pricing changes at least 30 days in advance.

---

## 5. Acceptable Use

You agree not to:

- Use SlopBlock to process code you do not have the right to access or share.
- Attempt to circumvent quiz requirements through automation, impersonation, or manipulation.
- Reverse engineer, decompile, or disassemble the service.
- Use the service in violation of any applicable law or regulation.
- Intentionally overload or disrupt the service.

---

## 6. Your Code and Data

### 6.1 Ownership

You retain all ownership rights to your code, repositories, and data. We claim no intellectual property rights over your code or the content of your pull requests.

### 6.2 License to Process

By installing SlopBlock, you grant us a limited, non-exclusive license to access and process your repository data (file paths, diffs, and file contents) solely for the purpose of generating and validating quiz questions. This license terminates when you uninstall the app.

### 6.3 LLM Provider Data Sharing

You acknowledge that repository file paths, code diffs, and file contents are sent to your configured LLM provider to generate quiz questions. You are responsible for ensuring this is permitted under your organization's policies and any applicable confidentiality obligations. We do not send usernames or personal identifiers to LLM providers.

---

## 7. Quiz Results and Merge Gating

SlopBlock sets a commit status check on pull requests. If you configure `slopblock` as a required status check in your branch protection rules, **pull requests cannot be merged until the quiz is passed**. We are not responsible for delays to your development workflow caused by quiz failures, service outages, or LLM provider downtime.

Quiz questions are generated by AI and may occasionally contain errors despite our two-model validation process. Quiz results should not be treated as a substitute for thorough code review.

---

## 8. Service Availability

SlopBlock is provided on an "as available" basis. We do not guarantee uninterrupted or error-free operation. The service depends on third-party infrastructure including GitHub, Vercel, and your configured LLM provider, any of which may experience downtime.

We reserve the right to modify, suspend, or discontinue the service at any time with reasonable notice.

---

## 9. Limitation of Liability

**To the maximum extent permitted by law, SlopBlock and its operator are not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service.** This includes, without limitation:

- Blocked or delayed merges due to service outages or quiz errors.
- Code or data exposed to third-party LLM providers through your configuration.
- **Any and all costs, charges, or fees incurred from LLM API token usage**, whether expected or unexpected, including charges resulting from high-volume repositories, misconfigured settings, service bugs, retries, or any other cause.
- Any bugs, vulnerabilities, or security incidents in code that passed a SlopBlock quiz.
- Financial losses resulting from failure to set billing caps or spending limits with your LLM provider.

**You expressly agree that SlopBlock bears no responsibility for LLM provider charges incurred through your use of the service.** You use your own API key, choose your own models, and configure your own usage limits. We provide built-in safeguards as a courtesy, but they do not constitute a guarantee of any cost ceiling.

Our total liability for any claim arising from the service is limited to the amount you paid us in the 12 months preceding the claim, or $50, whichever is greater.

---

## 10. Disclaimer of Warranties

**SlopBlock is provided "as is" and "as available" without warranties of any kind, whether express, implied, or statutory.** We disclaim all warranties including, without limitation, warranties of merchantability, fitness for a particular purpose, and non-infringement.

We do not warrant that:

- Quiz questions will be accurate, complete, or free of errors.
- The service will catch or prevent any particular class of bugs or security issues.
- The service will be uninterrupted, timely, or secure.

---

## 11. Indemnification

You agree to indemnify and hold harmless SlopBlock and its operator from any claims, damages, or expenses (including reasonable legal fees) arising from your use of the service, your violation of these Terms, or your violation of any third-party rights.

---

## 12. Termination

- You may stop using SlopBlock at any time by uninstalling the GitHub App.
- We may suspend or terminate your access if you violate these Terms, with notice where practicable.
- Upon termination, active quiz sessions are deleted when their associated PRs are closed or by our regular cleanup process. Quiz attempt records may be retained for auditing purposes per our [Privacy Policy](/privacy).

---

## 13. Changes to These Terms

We may update these Terms from time to time. If we make material changes, we will update the "Last Updated" date at the top of this page. Continued use of SlopBlock after changes constitutes acceptance of the updated Terms.

---

## 14. Governing Law

These Terms are governed by the laws of the United States. Any disputes arising from these Terms or your use of SlopBlock will be resolved in accordance with applicable law.

---

## 15. Contact

For questions about these Terms, contact:

**Sam Norris**
GitHub: [@sampnorris](https://github.com/sampnorris)
Email: [samuel@samscript.dev](mailto:samuel@samscript.dev)
