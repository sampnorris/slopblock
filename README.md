<p align="center">
  <img src="static/favicon.svg" alt="SlopBlock" width="120" />
</p>

<h1 align="center">SlopBlock</h1>

<p align="center">
  A GitHub App that gates pull request merges behind a diff-grounded quiz for the PR author.
</p>

## Goals

- Ask only about the diff.
- Avoid blocking obvious or trivial pull requests.
- Use repository context only to make better diff questions.
- Work with any OpenAI-compatible endpoint.
- Expose a required status check for branch protection.

## Current Service Shape

- Receive GitHub App webhooks for `pull_request` events.
- Post one managed PR comment and edit it in place.
- Ask one multiple-choice question at a time.
- Link the PR author to a dedicated authenticated answer UI.
- Update one commit status context named `slopblock`.
- Skip bots and fork PRs by default.
- Use heuristics first for trivial PR skipping, then ask the model only for borderline diffs.
- Generate multiple-choice questions adaptively based on diff size and risk.

## Stack

- Vercel-hosted REST handlers
- TypeScript
- Prisma
- PostgreSQL-compatible database
- GitHub App auth via `@octokit/app`
- Vercel AI Gateway for skip, generation, and validation

## Required Environment Variables

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `AI_GATEWAY_API_KEY`
- `AI_GATEWAY_BASE_URL` optional, defaults to `https://ai-gateway.vercel.sh/v1`
- `AI_GATEWAY_MODEL` optional
- `AI_GATEWAY_GENERATION_MODEL` optional
- `AI_GATEWAY_VALIDATION_MODEL` optional
- `AI_GATEWAY_SKIP_MODEL` optional
- `APP_BASE_URL` optional

Legacy `SLOPBLOCK_*` LLM variables still work, but the app now prefers Vercel AI Gateway env names.

If `AI_GATEWAY_MODEL` or `SLOPBLOCK_MODEL` is set, it overrides all internal model roles with one model. Otherwise, SlopBlock uses role-specific defaults.

## GitHub App Permissions

Recommended repository permissions:

- Contents: read
- Pull requests: read/write
- Issues: read/write
- Commit statuses: write
- Metadata: read

Subscribe to these webhook events:

- Pull request

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Generate Prisma client:

```bash
npm run prisma:generate
```

3. Run a local migration against your Postgres-compatible database:

```bash
npm run prisma:migrate -- --name init
```

4. Set the required environment variables.

If you pulled Vercel envs into `.env.local`, the included Neon database credentials are already in the right shape for Prisma.

5. Run the Vercel dev server or deploy handlers from `api/`.

## Vercel Deployment

1. Create a Vercel project from this repository.
2. Add all environment variables listed above.
3. Provision a Postgres-compatible database and set both `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
4. Keep the project as a serverless/API deployment. This repo includes `vercel.json` so Vercel should not expect a static `public` output directory.
5. Run Prisma migrations as part of deploy or separately in CI.
6. Point your GitHub App webhook URL to:

```text
https://<your-domain>/api/github/webhooks
```

7. Install the app on your test repository.

## Install On A Test Project

Once the GitHub App is deployed:

1. Install the GitHub App on the repository.
2. Open a draft PR, then mark it ready for review.
3. Watch for the `slopblock` status and the bot comment.
4. Open the answer link from the bot comment and sign in with GitHub.
5. Answer one question at a time in the linked UI until the status passes.
6. Add `slopblock` as a required branch protection status once satisfied.

## Configuration

All configuration is managed through the [SlopBlock app](https://github.com/apps/slop-block). After installing the app on a repository, use the app's settings UI to configure quiz behavior, heuristics, context budgets, and model preferences per repository.

## Local Prompt Harness

Build the project and run:

```bash
npm run build
AI_GATEWAY_API_KEY=... node dist/cli.cjs quiz --diff fixtures/diff.txt --context fixtures/context.json --questions 3
```

Run the local validation suite with:

```bash
npm run check
```

Use the included fixtures to smoke-test the prompts locally:

```bash
AI_GATEWAY_API_KEY=... node dist/cli.cjs skip --diff fixtures/diff.txt --files fixtures/files.txt
AI_GATEWAY_API_KEY=... node dist/cli.cjs quiz --diff fixtures/diff.txt --context fixtures/context.json --questions 3
```

## Known Limits

- Related code context is currently fetched from the repository over the GitHub API, so very large repos may need tighter context budgets.
- Fork PRs are skipped by default because repository secrets are not exposed there safely.
- One-question-at-a-time interaction currently uses a linked GitHub-authenticated answer UI.
- Model defaults are role-specific: quiz generation uses `anthropic/claude-sonnet-4.5`, validation uses `anthropic/claude-opus-4.1`, and borderline skip decisions use `anthropic/claude-sonnet-4.5` unless overridden.
- Local Prisma migrations use `.env.local`, which matches the Vercel/Neon environment pulled into this repo.

## Install Instructions

1. Create a GitHub App.
2. Set repository permissions:
   - Contents: read
   - Pull requests: read/write
   - Issues: read/write
   - Commit statuses: write
   - Metadata: read
3. Subscribe the app to webhook events:
    - Pull request
4. Deploy this repo to Vercel.
5. In Vercel, set these environment variables:
   - `DATABASE_URL`
   - `DATABASE_URL_UNPOOLED`
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY`
   - `GITHUB_WEBHOOK_SECRET`
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `AI_GATEWAY_API_KEY`
   - optional `AI_GATEWAY_BASE_URL`
   - optional `AI_GATEWAY_MODEL`
   - optional `AI_GATEWAY_GENERATION_MODEL`
   - optional `AI_GATEWAY_VALIDATION_MODEL`
   - optional `AI_GATEWAY_SKIP_MODEL`
   - optional `APP_BASE_URL`
6. Run Prisma migrations against your database:
   - locally: `npm run prisma:migrate -- --name init`
   - or in your deployment process
7. Point the GitHub App webhook URL to:
   - `https://<your-domain>/api/github/webhooks`
8. Install the app on a repository.
9. Configure the app's settings for the repository through the app UI.
10. Open a draft PR, then mark it ready for review.
11. Wait for the `slopblock` status and bot comment.
12. Answer the one-question-at-a-time quiz using the linked web UI.
13. Once satisfied, require `slopblock` in branch protection.
