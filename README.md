# slopblock

`slopblock` is a reusable GitHub Action that gates pull request merges behind a diff-grounded quiz for the PR author.

## Goals

- Ask only about the diff.
- Avoid blocking obvious or trivial pull requests.
- Use repository context only to make better diff questions.
- Work with any OpenAI-compatible endpoint.
- Expose a required status check for branch protection.

## Current v1 shape

- Trigger on `pull_request` when a PR is ready for review or updated.
- Trigger on `issue_comment` to grade the PR author's reply.
- Post one managed PR comment with the latest quiz.
- Update one commit status context named `slopblock`.
- Skip bots and fork PRs by default.
- Use heuristics first for trivial PR skipping, then ask the model only for borderline diffs.
- Generate multiple-choice questions adaptively based on diff size and risk.

## Required secrets

- `SLOPBLOCK_API_KEY`
- `SLOPBLOCK_BASE_URL`
- `SLOPBLOCK_MODEL` optional

If `SLOPBLOCK_MODEL` is set, it overrides all internal model roles with one model. Otherwise, slopblock uses role-specific defaults.

## Install On A Test Project

The simplest way to test `slopblock` today is from a second repository in the same machine or org.

1. Push this repository somewhere GitHub can access.
2. In your test repository, add `SLOPBLOCK_API_KEY` and `SLOPBLOCK_BASE_URL` as repository secrets.
3. Copy in the workflow from `.github/workflows/slopblock.yml` and make sure it grants `statuses: write`.
4. Change the action reference from `uses: ./` to your published repo ref, for example:

```yaml
- uses: sampnorris/slopblock@main
```

5. Add `.github/slopblock.yml` to the test repository.
6. Open a draft PR, then mark it ready for review.
7. Watch for the `slopblock` check and the managed PR comment.
8. Reply using the answer template.
9. If it works, add the `slopblock` status check as a required branch protection rule in the test repo.

For a zero-publish local smoke test, you can also point a workflow in this repo at `uses: ./` and exercise it with PRs against this repository.

## Release Notes

This repository now follows the normal JavaScript GitHub Action pattern:

- source lives under `src/`
- bundled runtime lives under `dist/`
- consumers use the published repo ref directly

Before tagging or pushing a release:

```bash
npm run check
git add src dist action.yml package.json package-lock.json README.md .github fixtures tests tsconfig.json scripts .gitignore
git commit -m "feat: add initial slopblock GitHub Action"
git tag v0.1.0
git push origin master --tags
```

When you change action runtime code later, rebuild `dist/` before committing:

```bash
npm run build
git add src dist
```

## Example workflow

```yaml
name: slopblock

on:
  pull_request:
    types: [ready_for_review, synchronize, reopened]
  issue_comment:
    types: [created]

permissions:
  contents: read
  issues: write
  pull-requests: write
  statuses: write

jobs:
  slopblock:
    if: github.event_name == 'pull_request' || github.event.issue.pull_request
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: ./
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          api-key: ${{ secrets.SLOPBLOCK_API_KEY }}
          base-url: ${{ secrets.SLOPBLOCK_BASE_URL }}
          model: ${{ secrets.SLOPBLOCK_MODEL }}
```

## Config

Create `.github/slopblock.yml`:

```yaml
checkName: slopblock
retryMode: new_quiz

questionCount:
  min: 2
  max: 5

passRule:
  requireAllCorrect: true

contextBudget:
  maxRepoFiles: 250
  maxRepoMapEntries: 120
  maxSnippetFiles: 12
  maxSnippetChars: 12000

heuristics:
  tinyChangeMaxLines: 4
  skipForkPullRequests: true
  skipBots: true
  docsGlobs:
    - docs/
    - '**/*.md'
  testGlobs:
    - tests/
    - '**/*.test.'
  riskyGlobs:
    - auth/
    - api/

llm:
  generationModel: gpt-4.1-mini
  validationModel: gpt-4.1
  skipModel: gpt-4.1-mini
```

## Local prompt harness

Build the project and run:

```bash
npm run build
SLOPBLOCK_API_KEY=... node dist/cli.cjs quiz --diff fixtures/diff.txt --context fixtures/context.json --questions 3
```

Run the local validation suite with:

```bash
npm run check
```

Use the included fixtures to smoke-test the prompts locally:

```bash
SLOPBLOCK_API_KEY=... SLOPBLOCK_BASE_URL=... node dist/cli.cjs skip --diff fixtures/diff.txt --files fixtures/files.txt
SLOPBLOCK_API_KEY=... SLOPBLOCK_BASE_URL=... node dist/cli.cjs quiz --diff fixtures/diff.txt --context fixtures/context.json --questions 3
```

## Known limits in v1

- The action stores canonical quiz state in a managed PR comment so it can survive separate workflow events.
- The best repo context comes from running `actions/checkout` before the action.
- Fork PRs are skipped by default because repository secrets are not exposed there safely.
- The bundled `dist/` output is intentionally committed so other repositories can consume this as a standard JavaScript action.
- The merge gate is implemented as a commit status context instead of a custom check run so it remains compatible with current GitHub Actions restrictions.
- The consuming workflow must grant `statuses: write` to `GITHUB_TOKEN` so slopblock can publish the merge-gating status context.
- Model defaults are role-specific: quiz generation uses `gpt-4.1-mini`, validation uses `gpt-4.1`, and borderline skip decisions use `gpt-4.1-mini` unless overridden.
