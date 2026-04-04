import type { SessionRecord } from "./session-store.js";

function pageShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #081019;
        --panel: rgba(12, 20, 34, 0.88);
        --line: rgba(148, 163, 184, 0.18);
        --text: #e5eefc;
        --muted: #94a3b8;
        --accent: #66e3c4;
        --accent-strong: #3dd9b3;
        --bad: #ff8f8f;
        --good: #8fffd8;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(61,217,179,0.14), transparent 34%),
          radial-gradient(circle at top right, rgba(102,227,196,0.10), transparent 28%),
          linear-gradient(180deg, #07111c, #04070d);
        color: var(--text);
        font: 15px/1.5 ui-sans-serif, system-ui, sans-serif;
        display: grid;
        place-items: center;
        padding: 32px 16px;
      }
      .card {
        width: min(860px, 100%);
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 28px;
        backdrop-filter: blur(14px);
        box-shadow: 0 24px 90px rgba(0,0,0,0.35);
      }
      .eyebrow {
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 11px;
        margin-bottom: 12px;
      }
      h1 { margin: 0 0 10px; font-size: clamp(28px, 5vw, 44px); line-height: 1.05; }
      p { margin: 0; color: var(--muted); }
      .meta { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 20px; color: var(--muted); font-size: 14px; }
      .pill {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 6px 10px;
        background: rgba(255,255,255,0.03);
      }
      .stack { display: grid; gap: 16px; margin-top: 24px; }
      .answers { display: grid; gap: 12px; margin-top: 24px; }
      button, .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        border: 1px solid rgba(102,227,196,0.2);
        background: linear-gradient(180deg, rgba(102,227,196,0.12), rgba(102,227,196,0.04));
        color: var(--text);
        border-radius: 16px;
        padding: 16px 18px;
        font: inherit;
        text-decoration: none;
        cursor: pointer;
        transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
      }
      button:hover, .button:hover { transform: translateY(-1px); border-color: rgba(102,227,196,0.5); }
      .choice-key {
        width: 34px;
        height: 34px;
        border-radius: 999px;
        display: inline-grid;
        place-items: center;
        margin-right: 12px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        flex: none;
      }
      .choice-text { text-align: left; flex: 1; }
      .notice { padding: 14px 16px; border-radius: 14px; border: 1px solid var(--line); }
      .notice.good { color: var(--good); }
      .notice.bad { color: var(--bad); }
      .footer { margin-top: 24px; font-size: 13px; color: var(--muted); }
    </style>
  </head>
  <body>
    <main class="card">${body}</main>
  </body>
</html>`;
}

export function renderLoginPage(session: SessionRecord): string {
  return pageShell(
    "slopblock sign in",
    `
      <div class="eyebrow">slopblock</div>
      <h1>Answer the PR quiz</h1>
      <p>Sign in with GitHub to prove you are the author of <strong>${session.repositoryOwner}/${session.repositoryName}#${session.pullNumber}</strong>.</p>
      <div class="meta">
        <div class="pill">One question at a time</div>
        <div class="pill">Multiple choice</div>
        <div class="pill">PR author only</div>
      </div>
      <div class="stack">
        <a class="button" href="/auth/start?session=${session.id}">Continue with GitHub</a>
      </div>
    `
  );
}

export function renderQuizPage(session: SessionRecord, actorLogin: string, result?: string): string {
  const question = session.quiz?.questions[session.currentQuestionIndex];
  const questionCount = session.quiz?.questions.length ?? 0;
  const resultNotice =
    result === "incorrect"
      ? `<div class="notice bad">That answer did not match the changed behavior. Try again.</div>`
      : result === "correct"
        ? `<div class="notice good">Correct. The next question is ready.</div>`
        : result === "passed"
          ? `<div class="notice good">Quiz complete. The PR status has been updated.</div>`
          : "";

  if (session.status === "passed") {
    return pageShell(
      "slopblock complete",
      `
        <div class="eyebrow">slopblock</div>
        <h1>Quiz passed</h1>
        <p>${actorLogin}, you have finished the quiz for <strong>${session.repositoryOwner}/${session.repositoryName}#${session.pullNumber}</strong>.</p>
        <div class="stack">${resultNotice}<a class="button" href="https://github.com/${session.repositoryOwner}/${session.repositoryName}/pull/${session.pullNumber}">Back to pull request</a></div>
      `
    );
  }

  return pageShell(
    "slopblock question",
    `
      <div class="eyebrow">slopblock</div>
      <h1>Question ${session.currentQuestionIndex + 1} of ${questionCount}</h1>
      <p>${session.summary ?? "Answer the question based on the code changes in this pull request."}</p>
      <div class="meta">
        <div class="pill">Repository: ${session.repositoryOwner}/${session.repositoryName}</div>
        <div class="pill">PR #${session.pullNumber}</div>
        <div class="pill">Signed in as ${actorLogin}</div>
      </div>
      <div class="stack">
        ${resultNotice}
        <div>
          <h2 style="margin:0 0 10px; font-size:22px; line-height:1.2;">${question?.prompt ?? "No active question."}</h2>
          <p>${question?.diffAnchors?.length ? `Based on: ${question.diffAnchors.join(", ")}` : "Diff-only question"}</p>
        </div>
        <form method="POST" action="/api/session/${session.id}/answer">
          <div class="answers">
            ${
              question?.options
                .map(
                  (option) => `
                    <button type="submit" name="answer" value="${option.key}">
                      <span class="choice-key">${option.key}</span>
                      <span class="choice-text">${option.text}</span>
                    </button>
                  `
                )
                .join("") ?? ""
            }
          </div>
        </form>
      </div>
      <div class="footer">Only the PR author can submit answers. Answers are checked against the current active question.</div>
    `
  );
}

export function renderErrorPage(title: string, message: string): string {
  return pageShell(
    title,
    `
      <div class="eyebrow">slopblock</div>
      <h1>${title}</h1>
      <p>${message}</p>
    `
  );
}
