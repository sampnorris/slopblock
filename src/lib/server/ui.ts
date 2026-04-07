import { createHash, createHmac } from "node:crypto";
import type { QuizQuestion } from "./types.js";
import type { SessionRecord } from "./session-store.js";
import { renderMarkdown } from "../markdown.js";

function hmacAnswer(questionId: string, key: string, secret: string): string {
  return createHmac("sha256", secret).update(`${questionId}:${key}`).digest("hex").slice(0, 16);
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function quizSecret(): string {
  return process.env.GITHUB_WEBHOOK_SECRET ?? "slopblock";
}

function diffAnchorUrl(session: SessionRecord, anchor: string): string {
  const base = `https://github.com/${session.repositoryOwner}/${session.repositoryName}/pull/${session.pullNumber}/files`;
  const clean = anchor.replace(/^[+\-~]\s*/, "").split(/[:#]/)[0];
  if (clean) {
    return `${base}#diff-${sha256Hex(clean)}`;
  }
  return base;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function modelBadge(label: string, value?: string): string {
  if (!value) return "";
  return `<div class="pill" title="${escapeHtml(value)}">${escapeHtml(label)}: <code>${escapeHtml(value)}</code></div>`;
}

function escapeAttribute(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function pageShell(title: string, body: string, script?: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: light;
        --pink-50: #fdf2f6;
        --pink-100: #fce7ef;
        --pink-200: #f9c4d8;
        --pink-300: #f5a0c0;
        --pink-400: #e8709a;
        --pink-500: #d4507e;
        --pink-600: #b83a64;
        --pink-700: #9a2d50;
        --gray-50: #fafafa;
        --gray-100: #f4f4f5;
        --gray-200: #e4e4e7;
        --gray-300: #d4d4d8;
        --gray-400: #a1a1aa;
        --gray-500: #71717a;
        --gray-600: #52525b;
        --gray-700: #3f3f46;
        --gray-800: #27272a;
        --gray-900: #18181b;
        --bg: var(--gray-100);
        --surface: #ffffff;
        --panel: #ffffff;
        --line: var(--gray-200);
        --text: var(--gray-900);
        --muted: var(--gray-500);
        --accent: var(--pink-500);
        --accent-light: var(--pink-100);
        --accent-strong: var(--pink-600);
        --bad: #e54d4d;
        --bad-light: #fde8e8;
        --good: #16a34a;
        --good-light: #dcfce7;
        --radius-sm: 8px;
        --radius-md: 12px;
        --radius-lg: 16px;
        --radius-xl: 20px;
        --radius-pill: 999px;
        --shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(ellipse at top left, rgba(232, 112, 154, 0.08), transparent 50%),
          radial-gradient(ellipse at bottom right, rgba(245, 198, 208, 0.12), transparent 50%),
          var(--bg);
        color: var(--text);
        font: 400 15px/1.6 "DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
        display: grid;
        place-items: center;
        padding: 32px 16px;
        -webkit-font-smoothing: antialiased;
      }
      a { color: var(--accent); text-decoration: none; }
      a:hover { color: var(--accent-strong); }
      .card {
        width: min(720px, 100%);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius-xl);
        padding: 28px;
        box-shadow: var(--shadow-card);
      }
      .brand-strip {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 24px;
        padding-bottom: 20px;
        border-bottom: 1px solid var(--line);
      }
      .brand-icon {
        width: 32px; height: 32px; border-radius: 10px;
        background: linear-gradient(135deg, var(--pink-400), var(--pink-600));
        display: grid; place-items: center; color: #fff; flex: none;
      }
      .brand-icon svg { width: 16px; height: 16px; }
      .brand-name { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; color: var(--gray-800); }
      h1 { margin: 0 0 8px; font-family: "Playfair Display", serif; font-size: clamp(26px, 4vw, 38px); font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; color: var(--gray-900); }
      h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; line-height: 1.3; color: var(--gray-800); }
      p { margin: 0; color: var(--muted); }
      p strong { color: var(--gray-800); font-weight: 600; }
      .meta { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; color: var(--muted); font-size: 13px; }
      .pill { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: var(--radius-pill); padding: 5px 12px; background: var(--gray-50); font-size: 13px; font-weight: 500; color: var(--gray-600); }
      .pill.pink { background: var(--pink-50); border-color: var(--pink-200); color: var(--pink-600); }
      .stack { display: grid; gap: 20px; margin-top: 20px; }
      .question-block { border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 24px; background: var(--gray-50); }
      .question-block.answered .choice-btn { pointer-events: none; }
      .question-header { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
      .question-number { width: 36px; height: 36px; border-radius: 50%; background: var(--pink-100); color: var(--pink-600); display: grid; place-items: center; font-weight: 700; font-size: 15px; flex: none; }
      .question-label { font-size: 13px; color: var(--muted); font-weight: 500; }
      .question-prompt { color: var(--gray-800); font-size: 15px; line-height: 1.6; margin-bottom: 6px; }
      .markdown p, .choice-markdown p { margin: 0; color: inherit; }
      .markdown p + p, .choice-markdown p + p { margin-top: 10px; }
      .markdown ul, .markdown ol, .choice-markdown ul, .choice-markdown ol { margin: 8px 0 0 20px; padding: 0; }
      .markdown li + li, .choice-markdown li + li { margin-top: 4px; }
      .markdown code, .choice-markdown code, .pill code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.92em; background: rgba(24, 24, 27, 0.06); padding: 0.12em 0.35em; border-radius: 6px; }
      .diff-anchors { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); margin-top: 6px; flex-wrap: wrap; }
      .diff-anchors a { color: var(--accent); text-decoration: none; }
      .diff-anchors a:hover { text-decoration: underline; }
      .answers { display: grid; gap: 8px; margin-top: 14px; }
      .choice-btn {
        display: flex; align-items: center; width: 100%;
        border: 1px solid var(--line); background: var(--surface); color: var(--gray-800);
        border-radius: var(--radius-md); padding: 12px 16px; font: inherit; font-size: 14px;
        cursor: pointer; transition: all 150ms ease;
      }
      .choice-btn:hover { border-color: var(--pink-300); background: var(--pink-50); transform: translateY(-1px); }
      .choice-btn.correct { border-color: rgba(22, 163, 74, 0.4); background: var(--good-light); color: var(--good); pointer-events: none; }
      .choice-btn.wrong { border-color: rgba(229, 77, 77, 0.4); background: var(--bad-light); color: var(--bad); opacity: 0.7; pointer-events: none; }
      .choice-btn.dimmed { opacity: 0.35; pointer-events: none; }
      .choice-key {
        width: 30px; height: 30px; border-radius: 8px; display: inline-grid; place-items: center;
        margin-right: 12px; background: var(--gray-100); border: 1px solid var(--gray-200); flex: none;
        font-weight: 700; font-size: 13px; color: var(--gray-600);
      }
      .choice-btn.correct .choice-key { background: rgba(22,163,74,0.15); border-color: rgba(22,163,74,0.3); color: var(--good); }
      .choice-btn.wrong .choice-key { background: rgba(229,77,77,0.15); border-color: rgba(229,77,77,0.3); color: var(--bad); }
      .choice-text { text-align: left; flex: 1; }
      .explanation {
        margin-top: 12px; padding: 12px 16px; border-radius: var(--radius-md);
        border: 1px solid var(--line); font-size: 14px; color: var(--muted); display: none; background: var(--surface);
      }
      .explanation.visible { display: block; }
      .explanation.good { border-color: rgba(22, 163, 74, 0.25); color: var(--good); background: var(--good-light); }
      .explanation.bad { border-color: rgba(229, 77, 77, 0.25); color: var(--bad); background: var(--bad-light); }
      .progress-bar { height: 6px; border-radius: 3px; background: var(--gray-200); margin-top: 20px; overflow: hidden; }
      .progress-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--pink-400), var(--pink-600)); transition: width 400ms cubic-bezier(0.25, 1, 0.5, 1); }
      .result-section { display: none; margin-top: 24px; }
      .result-section.visible { display: block; }
      .score-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 20px; border-radius: var(--radius-lg); margin-bottom: 16px; }
      .score-card.pass { background: var(--good-light); border: 1px solid rgba(22,163,74,0.2); }
      .score-card.fail { background: var(--bad-light); border: 1px solid rgba(229,77,77,0.2); }
      .score-value { font-size: 28px; font-family: "Playfair Display", serif; font-weight: 700; }
      .score-card.pass .score-value { color: var(--good); }
      .score-card.fail .score-value { color: var(--bad); }
      .score-label { font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; }
      .score-card.pass .score-label { color: var(--good); opacity: 0.7; }
      .score-card.fail .score-label { color: var(--bad); opacity: 0.7; }
      .button {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        width: 100%; border: 1px solid var(--line); background: var(--surface); color: var(--gray-700);
        border-radius: var(--radius-lg); padding: 14px 20px; font: inherit; font-size: 14px; font-weight: 600;
        text-decoration: none; cursor: pointer; transition: all 150ms ease;
      }
      .button:hover { border-color: var(--gray-300); background: var(--gray-50); transform: translateY(-1px); }
      .button.primary {
        background: linear-gradient(135deg, var(--pink-400), var(--pink-600));
        color: #fff; font-weight: 600; border: none; box-shadow: 0 2px 8px rgba(212, 80, 126, 0.25);
      }
      .button.primary:hover { background: linear-gradient(135deg, var(--pink-500), var(--pink-700)); box-shadow: 0 4px 16px rgba(212, 80, 126, 0.35); transform: translateY(-1px); }
      .notice { padding: 14px 18px; border-radius: var(--radius-md); border: 1px solid var(--line); font-size: 14px; font-weight: 500; background: var(--gray-50); }
      .notice.good { color: var(--good); border-color: rgba(22, 163, 74, 0.25); background: var(--good-light); }
      .footer { margin-top: 24px; font-size: 13px; color: var(--muted); }
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
      <div class="brand-strip">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <span class="brand-name">slopblock</span>
      </div>
      <h1>Answer the PR quiz</h1>
      <p>Sign in with GitHub to prove you are the author of <strong>${escapeHtml(session.repositoryOwner)}/${escapeHtml(session.repositoryName)}#${session.pullNumber}</strong>.</p>
      <div class="meta">
        <div class="pill pink">${session.questionCount} questions</div>
        <div class="pill">Multiple choice</div>
        <div class="pill">PR author only</div>
      </div>
      <div class="stack" style="margin-top: 28px;">
        <a class="button primary" href="/auth/start?session=${session.id}">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          Continue with GitHub
        </a>
      </div>
    `,
  );
}

function renderQuestionBlock(
  question: QuizQuestion,
  index: number,
  total: number,
  session: SessionRecord,
  hashes: Record<string, string>,
): string {
  const anchors = (question.diffAnchors ?? [])
    .map(
      (a) =>
        `<a href="${escapeHtml(diffAnchorUrl(session, a))}" target="_blank">${escapeHtml(a)}</a>`,
    )
    .join(", ");

  const options = question.options
    .map(
      (opt) => `
        <button type="button" class="choice-btn" data-question="${index}" data-key="${opt.key}" data-hash="${hashes[`${question.id}:${opt.key}`] ?? ""}">
          <span class="choice-key">${escapeHtml(opt.key)}</span>
          <span class="choice-text choice-markdown">${renderMarkdown(opt.text)}</span>
        </button>
      `,
    )
    .join("");

  return `
    <div class="question-block" id="q${index}" data-index="${index}" data-correct-hash="${hashes[`${question.id}:correct`] ?? ""}">
      <div class="question-header">
        <span class="question-number">${index + 1}</span>
        <div>
          <span class="question-label">Question ${index + 1} of ${total}</span>
        </div>
      </div>
      <div class="question-prompt markdown">${renderMarkdown(question.prompt)}</div>
      ${anchors ? `<div class="diff-anchors">Based on: ${anchors}</div>` : ""}
      <div class="answers">${options}</div>
      <div class="explanation markdown" id="exp${index}" data-explanation="${escapeAttribute(renderMarkdown(question.explanation))}"></div>
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
        <div class="brand-strip">
          <div class="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <span class="brand-name">slopblock</span>
        </div>
        <div style="width:56px;height:56px;border-radius:50%;background:var(--good-light);color:var(--good);display:grid;place-items:center;margin-bottom:16px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h1>Quiz passed</h1>
        <p>${escapeHtml(actorLogin)}, you passed the quiz for <strong>${escapeHtml(session.repositoryOwner)}/${escapeHtml(session.repositoryName)}#${session.pullNumber}</strong>.</p>
        <div class="stack">
          <div class="notice good">All questions answered correctly. The PR status has been updated.</div>
          <a class="button primary" href="${escapeHtml(prUrl)}">Back to pull request</a>
        </div>
      `,
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
    if (counter) counter.textContent = answered + ' of ' + total;
  }

  function showResult() {
    var section = document.getElementById('result-section');
    var scoreValue = document.getElementById('score-value');
    var scoreLabel = document.getElementById('score-label');
    var scoreCard = document.getElementById('score-card');
    var passed = correct === total;
    scoreValue.textContent = correct + ' / ' + total;
    scoreLabel.textContent = passed ? 'Perfect score' : 'Questions correct';
    scoreCard.className = 'score-card ' + (passed ? 'pass' : 'fail');
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
      exp.innerHTML = exp.dataset.explanation;
    } else {
      btn.classList.add('wrong');
      exp.className = 'explanation visible bad';
      exp.innerHTML = exp.dataset.explanation;
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
      <div class="brand-strip">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <span class="brand-name">slopblock</span>
      </div>
      <h1>${escapeHtml(session.repositoryOwner)}/${escapeHtml(session.repositoryName)}#${session.pullNumber}</h1>
      <div class="markdown">${renderMarkdown(session.summary ?? "Answer the questions based on the code changes in this pull request.")}</div>
      <div class="meta">
        <div class="pill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0113 0"/></svg>
          ${escapeHtml(actorLogin)}
        </div>
        <div class="pill pink" id="progress-text">0 of ${total}</div>
        ${modelBadge("Created by", session.generationModel)}
        ${modelBadge("Validated by", session.validationModel)}
        <div class="pill"><a href="${escapeHtml(prUrl)}/files" target="_blank" style="color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          View diff
        </a></div>
      </div>
      <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width: 0%"></div></div>
      <div class="stack">
        ${questionBlocks}
      </div>
      <div class="result-section" id="result-section">
        <div class="score-card" id="score-card">
          <span class="score-value" id="score-value"></span>
          <span class="score-label" id="score-label"></span>
        </div>
        <div class="stack">
          <button class="button primary" id="submit-btn" style="display:none">Submit &amp; pass PR</button>
          <button class="button" id="retry-btn" style="display:none">Try again (same quiz)</button>
          <button class="button" id="retry-new-btn" style="display:none">Generate new quiz</button>
          <a class="button" href="${escapeHtml(prUrl)}">Back to pull request</a>
        </div>
      </div>
      <div class="footer">Only the PR author can submit answers. All questions must be correct to pass.</div>
    `,
    script,
  );
}

export function renderErrorPage(title: string, message: string): string {
  return pageShell(
    escapeHtml(title),
    `
      <div class="brand-strip">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <span class="brand-name">slopblock</span>
      </div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    `,
  );
}
