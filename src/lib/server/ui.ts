import { createHmac } from "node:crypto";
import type { QuizQuestion } from "./types.js";
import type { SessionRecord } from "./session-store.js";

function hmacAnswer(questionId: string, key: string, secret: string): string {
  return createHmac("sha256", secret).update(`${questionId}:${key}`).digest("hex").slice(0, 16);
}

function quizSecret(): string {
  return process.env.GITHUB_WEBHOOK_SECRET ?? "slopblock";
}

function diffAnchorUrl(session: SessionRecord, anchor: string): string {
  const base = `https://github.com/${session.repositoryOwner}/${session.repositoryName}/pull/${session.pullNumber}/files`;
  const clean = anchor.replace(/^[+\-~]\s*/, "").split(/[:#]/)[0];
  if (clean) {
    return `${base}#diff-${encodeURIComponent(clean)}`;
  }
  return base;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pageShell(title: string, body: string, script?: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
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
      h2 { margin: 0 0 10px; font-size: 20px; line-height: 1.3; }
      p { margin: 0; color: var(--muted); }
      a { color: var(--accent); }
      .meta { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 20px; color: var(--muted); font-size: 14px; }
      .pill {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 6px 10px;
        background: rgba(255,255,255,0.03);
      }
      .stack { display: grid; gap: 24px; margin-top: 24px; }
      .question-block { border-top: 1px solid var(--line); padding-top: 20px; }
      .question-block.answered .choice-btn { pointer-events: none; }
      .diff-anchors { font-size: 13px; color: var(--muted); margin-top: 6px; }
      .diff-anchors a { color: var(--accent); text-decoration: none; }
      .diff-anchors a:hover { text-decoration: underline; }
      .answers { display: grid; gap: 10px; margin-top: 14px; }
      .choice-btn {
        display: flex;
        align-items: center;
        width: 100%;
        border: 1px solid rgba(102,227,196,0.2);
        background: linear-gradient(180deg, rgba(102,227,196,0.12), rgba(102,227,196,0.04));
        color: var(--text);
        border-radius: 16px;
        padding: 14px 16px;
        font: inherit;
        text-decoration: none;
        cursor: pointer;
        transition: transform 120ms ease, border-color 120ms ease, background 120ms ease, opacity 120ms ease;
      }
      .choice-btn:hover { transform: translateY(-1px); border-color: rgba(102,227,196,0.5); }
      .choice-btn.correct {
        border-color: var(--good);
        background: rgba(143, 255, 216, 0.15);
        pointer-events: none;
      }
      .choice-btn.wrong {
        border-color: var(--bad);
        background: rgba(255, 143, 143, 0.10);
        opacity: 0.6;
        pointer-events: none;
      }
      .choice-btn.dimmed {
        opacity: 0.35;
        pointer-events: none;
      }
      .choice-key {
        width: 32px;
        height: 32px;
        border-radius: 999px;
        display: inline-grid;
        place-items: center;
        margin-right: 12px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        flex: none;
        font-weight: 600;
      }
      .choice-text { text-align: left; flex: 1; }
      .explanation {
        margin-top: 10px;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid var(--line);
        font-size: 14px;
        color: var(--muted);
        display: none;
      }
      .explanation.visible { display: block; }
      .explanation.good { border-color: rgba(143, 255, 216, 0.3); color: var(--good); }
      .explanation.bad { border-color: rgba(255, 143, 143, 0.3); color: var(--bad); }
      .progress-bar {
        height: 6px;
        border-radius: 3px;
        background: rgba(255,255,255,0.06);
        margin-top: 20px;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        border-radius: 3px;
        background: var(--accent);
        transition: width 300ms ease;
      }
      .result-section { display: none; margin-top: 24px; }
      .result-section.visible { display: block; }
      .button {
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
      .button:hover { transform: translateY(-1px); border-color: rgba(102,227,196,0.5); }
      .button.primary {
        background: linear-gradient(180deg, var(--accent), var(--accent-strong));
        color: #081019;
        font-weight: 600;
        border-color: var(--accent);
      }
      .button.primary:hover { opacity: 0.9; }
      .score { font-size: 18px; font-weight: 600; margin: 10px 0; }
      .score.pass { color: var(--good); }
      .score.fail { color: var(--bad); }
      .footer { margin-top: 24px; font-size: 13px; color: var(--muted); }
      .notice { padding: 14px 16px; border-radius: 14px; border: 1px solid var(--line); }
      .notice.good { color: var(--good); border-color: rgba(143, 255, 216, 0.3); }
    </style>
  </head>
  <body>
    <main class="card">${body}</main>
    ${script ? `<script>${script}</script>` : ""}
  </body>
</html>`;
}

export function renderLoginPage(session: SessionRecord): string {
  return pageShell(
    "slopblock - sign in",
    `
      <div class="eyebrow">slopblock</div>
      <h1>Answer the PR quiz</h1>
      <p>Sign in with GitHub to prove you are the author of <strong>${escapeHtml(session.repositoryOwner)}/${escapeHtml(session.repositoryName)}#${session.pullNumber}</strong>.</p>
      <div class="meta">
        <div class="pill">${session.questionCount} questions</div>
        <div class="pill">Multiple choice</div>
        <div class="pill">PR author only</div>
      </div>
      <div class="stack">
        <a class="button primary" href="/auth/start?session=${session.id}">Continue with GitHub</a>
      </div>
    `
  );
}

function renderQuestionBlock(question: QuizQuestion, index: number, total: number, session: SessionRecord, hashes: Record<string, string>): string {
  const anchors = (question.diffAnchors ?? [])
    .map((a) => `<a href="${escapeHtml(diffAnchorUrl(session, a))}" target="_blank">${escapeHtml(a)}</a>`)
    .join(", ");

  const options = question.options
    .map(
      (opt) => `
        <button type="button" class="choice-btn" data-question="${index}" data-key="${opt.key}" data-hash="${hashes[`${question.id}:${opt.key}`] ?? ""}">
          <span class="choice-key">${escapeHtml(opt.key)}</span>
          <span class="choice-text">${escapeHtml(opt.text)}</span>
        </button>
      `
    )
    .join("");

  return `
    <div class="question-block" id="q${index}" data-index="${index}" data-correct-hash="${hashes[`${question.id}:correct`] ?? ""}">
      <h2>Question ${index + 1} of ${total}</h2>
      <p style="color: var(--text); margin-bottom: 4px;">${escapeHtml(question.prompt)}</p>
      ${anchors ? `<div class="diff-anchors">Based on: ${anchors}</div>` : ""}
      <div class="answers">${options}</div>
      <div class="explanation" id="exp${index}" data-explanation="${escapeHtml(question.explanation)}"></div>
    </div>
  `;
}

export function renderQuizPage(session: SessionRecord, actorLogin: string): string {
  const prUrl = `https://github.com/${session.repositoryOwner}/${session.repositoryName}/pull/${session.pullNumber}`;
  const questions = session.quiz?.questions ?? [];
  const total = questions.length;

  if (session.status === "passed") {
    return pageShell(
      "slopblock - passed",
      `
        <div class="eyebrow">slopblock</div>
        <h1>Quiz passed</h1>
        <p>${escapeHtml(actorLogin)}, you passed the quiz for <strong>${escapeHtml(session.repositoryOwner)}/${escapeHtml(session.repositoryName)}#${session.pullNumber}</strong>.</p>
        <div class="stack">
          <div class="notice good">All questions answered correctly. The PR status has been updated.</div>
          <a class="button primary" href="${escapeHtml(prUrl)}">Back to pull request</a>
        </div>
      `
    );
  }

  const secret = quizSecret();
  const hashes: Record<string, string> = {};
  for (const q of questions) {
    for (const opt of q.options) {
      hashes[`${q.id}:${opt.key}`] = hmacAnswer(q.id, opt.key, secret);
    }
    hashes[`${q.id}:correct`] = hmacAnswer(q.id, q.correctOption, secret);
  }

  const questionBlocks = questions
    .map((q, i) => renderQuestionBlock(q, i, total, session, hashes))
    .join("");

  const script = `
(function() {
  var answered = 0;
  var correct = 0;
  var total = ${total};
  var sessionId = ${JSON.stringify(session.id)};
  var retryMode = ${JSON.stringify(session.retryMode)};

  function updateProgress() {
    var pct = total > 0 ? (answered / total) * 100 : 0;
    var fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = pct + '%';
    var counter = document.getElementById('progress-text');
    if (counter) counter.textContent = answered + ' of ' + total + ' answered';
  }

  function showResult() {
    var section = document.getElementById('result-section');
    var scoreEl = document.getElementById('score');
    var passed = correct === total;
    scoreEl.textContent = correct + ' / ' + total + ' correct';
    scoreEl.className = 'score ' + (passed ? 'pass' : 'fail');
    section.className = 'result-section visible';

    var submitBtn = document.getElementById('submit-btn');
    var retryBtn = document.getElementById('retry-btn');
    var retryNewBtn = document.getElementById('retry-new-btn');

    if (passed) {
      submitBtn.style.display = '';
      retryBtn.style.display = 'none';
      retryNewBtn.style.display = 'none';
      submitBtn.onclick = function() {
        submitBtn.textContent = 'Submitting...';
        submitBtn.style.pointerEvents = 'none';
        fetch('/api/session/' + sessionId + '/answer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ action: 'pass' })
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.ok) {
            submitBtn.textContent = 'Passed!';
            window.location.reload();
          } else {
            submitBtn.textContent = 'Error: ' + (data.message || 'Unknown');
            submitBtn.style.pointerEvents = '';
          }
        }).catch(function() {
          submitBtn.textContent = 'Network error, try again';
          submitBtn.style.pointerEvents = '';
        });
      };
    } else {
      submitBtn.style.display = 'none';
      if (retryMode === 'new_quiz') {
        retryNewBtn.style.display = '';
        retryBtn.style.display = 'none';
        retryNewBtn.onclick = function() {
          retryNewBtn.textContent = 'Generating new quiz...';
          retryNewBtn.style.pointerEvents = 'none';
          fetch('/api/session/' + sessionId + '/answer', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ action: 'retry_new' })
          }).then(function(r) { return r.json(); }).then(function(data) {
            if (data.ok) { window.location.reload(); }
            else {
              retryNewBtn.textContent = 'Error: ' + (data.message || 'Unknown');
              retryNewBtn.style.pointerEvents = '';
            }
          }).catch(function() {
            retryNewBtn.textContent = 'Network error, try again';
            retryNewBtn.style.pointerEvents = '';
          });
        };
      } else {
        retryBtn.style.display = '';
        retryNewBtn.style.display = 'none';
        retryBtn.onclick = function() {
          window.location.reload();
        };
      }
    }
  }

  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.choice-btn');
    if (!btn) return;
    var block = btn.closest('.question-block');
    if (block.classList.contains('answered')) return;
    block.classList.add('answered');

    var idx = parseInt(btn.dataset.question, 10);
    var selectedHash = btn.dataset.hash;
    var correctHash = block.dataset.correctHash;
    var isCorrect = selectedHash === correctHash;
    var exp = document.getElementById('exp' + idx);

    if (isCorrect) {
      btn.classList.add('correct');
      correct++;
      exp.className = 'explanation visible good';
      exp.textContent = exp.dataset.explanation;
    } else {
      btn.classList.add('wrong');
      exp.className = 'explanation visible bad';
      exp.textContent = exp.dataset.explanation;
      var buttons = block.querySelectorAll('.choice-btn');
      for (var i = 0; i < buttons.length; i++) {
        if (buttons[i] !== btn) {
          if (buttons[i].dataset.hash === correctHash) {
            buttons[i].classList.add('correct');
          } else {
            buttons[i].classList.add('dimmed');
          }
        }
      }
    }

    answered++;
    updateProgress();
    if (answered === total) {
      showResult();
    } else {
      var next = document.getElementById('q' + (idx + 1));
      if (next) {
        setTimeout(function() {
          next.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    }
  });

  updateProgress();
})();
`;

  return pageShell(
    "slopblock - quiz",
    `
      <div class="eyebrow">slopblock</div>
      <h1>${escapeHtml(session.repositoryOwner)}/${escapeHtml(session.repositoryName)}#${session.pullNumber}</h1>
      <p>${escapeHtml(session.summary ?? "Answer the questions based on the code changes in this pull request.")}</p>
      <div class="meta">
        <div class="pill">Signed in as ${escapeHtml(actorLogin)}</div>
        <div class="pill" id="progress-text">0 of ${total} answered</div>
        <div class="pill"><a href="${escapeHtml(prUrl)}/files" target="_blank" style="color: inherit; text-decoration: none;">View diff</a></div>
      </div>
      <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width: 0%"></div></div>
      <div class="stack">
        ${questionBlocks}
      </div>
      <div class="result-section" id="result-section">
        <div class="score" id="score"></div>
        <div class="stack">
          <button class="button primary" id="submit-btn" style="display:none">Submit &amp; pass PR</button>
          <button class="button" id="retry-btn" style="display:none">Try again (same quiz)</button>
          <button class="button" id="retry-new-btn" style="display:none">Generate new quiz</button>
          <a class="button" href="${escapeHtml(prUrl)}">Back to pull request</a>
        </div>
      </div>
      <div class="footer">Only the PR author can submit answers. All questions must be correct to pass.</div>
    `,
    script
  );
}

export function renderErrorPage(title: string, message: string): string {
  return pageShell(
    escapeHtml(title),
    `
      <div class="eyebrow">slopblock</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    `
  );
}
