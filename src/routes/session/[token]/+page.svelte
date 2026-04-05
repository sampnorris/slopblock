<script lang="ts">
  import SlopBlockLogo from "$lib/components/SlopBlockLogo.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const { session, actor, prUrl } = data;
  const questions = session.questions;
  const total = questions.length;

  let answered = $state(0);
  let correct = $state(0);
  let questionStates = $state<Array<{ answered: boolean; selectedKey: string | null; isCorrect: boolean | null }>>(
    questions.map(() => ({ answered: false, selectedKey: null, isCorrect: null }))
  );
  let submitting = $state(false);
  let submitMessage = $state("");
  let retrying = $state(false);

  function diffAnchorUrl(anchor: string): string {
    const base = `${prUrl}/files`;
    const clean = anchor.replace(/^[+\-~]\s*/, "").split(/[:#]/)[0];
    return clean ? `${base}#diff-${encodeURIComponent(clean)}` : base;
  }

  function selectAnswer(qIndex: number, key: string) {
    if (questionStates[qIndex].answered) return;

    const q = questions[qIndex];
    const isCorrect = q.correctOption === key;

    questionStates[qIndex] = { answered: true, selectedKey: key, isCorrect };
    answered++;
    if (isCorrect) correct++;

    if (answered < total) {
      setTimeout(() => {
        const next = document.getElementById(`q${qIndex + 1}`);
        next?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }

  function btnClass(qIndex: number, key: string): string {
    const st = questionStates[qIndex];
    if (!st.answered) return "choice-btn";
    const q = questions[qIndex];
    if (key === st.selectedKey) {
      return st.isCorrect ? "choice-btn correct" : "choice-btn wrong";
    }
    if (key === q.correctOption) return "choice-btn correct";
    return "choice-btn dimmed";
  }

  function selectedAnswers(): Record<string, string> {
    return Object.fromEntries(
      questions.map((question, index) => [question.id, questionStates[index].selectedKey ?? ""])
    );
  }

  async function submitPass() {
    submitting = true;
    submitMessage = "";
    try {
      const res = await fetch(`/api/session/${session.id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "pass", answers: selectedAnswers() })
      });
      const json = await res.json();
      if (json.ok) {
        if (json.passed) {
          window.location.reload();
        } else {
          submitMessage = `Recorded attempt ${json.attemptNumber}. Score: ${json.correctCount} / ${json.questionCount}.`;
        }
      } else {
        submitMessage = json.message || "Unknown error";
      }
    } catch {
      submitMessage = "Network error, try again";
    } finally {
      submitting = false;
    }
  }

  async function retryNew() {
    retrying = true;
    submitMessage = "";
    try {
      const res = await fetch(`/api/session/${session.id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "retry_new" })
      });
      const json = await res.json();
      if (json.ok) {
        window.location.reload();
      } else {
        submitMessage = json.message || "Unknown error";
      }
    } catch {
      submitMessage = "Network error, try again";
    } finally {
      retrying = false;
    }
  }

  function retrySame() {
    window.location.reload();
  }

  let progressPct = $derived(total > 0 ? (answered / total) * 100 : 0);
</script>

<svelte:head>
  <title>SlopBlock - {session.status === "passed" ? "passed" : "quiz"}</title>
</svelte:head>

<div class="centered-layout">
  <main class="card">
    <!-- Brand header -->
    <div class="brand-strip">
      <div class="brand-icon">
        <SlopBlockLogo width={20} height={20} />
      </div>
      <span class="brand-name">SlopBlock</span>
    </div>

    {#if !actor}
      <!-- Login page -->
      <div class="hero-section">
        <h1>Answer the PR quiz</h1>
        <p>Sign in with GitHub to prove you are the author of <strong>{session.repositoryOwner}/{session.repositoryName}#{session.pullNumber}</strong>.</p>
      </div>
      <div class="meta">
        <div class="pill pink">{session.questionCount} questions</div>
        <div class="pill">Multiple choice</div>
        <div class="pill">PR author only</div>
      </div>
      <div class="stack" style="margin-top: 28px;">
        <a class="button primary" href="/auth/start?session={session.id}">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          Continue with GitHub
        </a>
      </div>

    {:else if session.status === "passed"}
      <!-- Passed page -->
      <div class="hero-section">
        <div class="passed-badge">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h1>Quiz passed</h1>
        <p>{actor.login}, you passed the quiz for <strong>{session.repositoryOwner}/{session.repositoryName}#{session.pullNumber}</strong>.</p>
      </div>
      <div class="stack">
        <div class="notice good">All questions answered correctly. The PR status has been updated.</div>
        <a class="button primary" href={prUrl}>Back to pull request</a>
      </div>

    {:else}
      <!-- Quiz page -->
      <div class="hero-section">
        <h1>{session.repositoryOwner}/{session.repositoryName}#{session.pullNumber}</h1>
        <p>{session.summary ?? "Answer the questions based on the code changes in this pull request."}</p>
      </div>

      <div class="meta">
        <div class="pill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0113 0"/></svg>
          {actor.login}
        </div>
        <div class="pill pink">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          {answered} of {total}
        </div>
        {#if session.generationModel}
          <div class="pill">Created by: <code>{session.generationModel}</code></div>
        {/if}
        {#if session.validationModel}
          <div class="pill">Validated by: <code>{session.validationModel}</code></div>
        {/if}
        <div class="pill">
          <a href="{prUrl}/files" target="_blank" style="color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            View diff
          </a>
        </div>
      </div>

      <div class="progress-bar">
        <div class="progress-fill" style="width: {progressPct}%"></div>
      </div>

      <div class="stack">
        {#each questions as q, i}
          <div class="question-block" class:answered={questionStates[i].answered} id="q{i}">
            <div class="question-header">
              <span class="question-number">{i + 1}</span>
              <div class="question-meta">
                <span class="question-label">Question {i + 1} of {total}</span>
                {#if questionStates[i].answered}
                  {#if questionStates[i].isCorrect}
                    <span class="question-status correct">Correct</span>
                  {:else}
                    <span class="question-status wrong">Incorrect</span>
                  {/if}
                {/if}
              </div>
            </div>
            <p class="question-prompt">{q.prompt}</p>
            {#if q.diffAnchors?.length}
              <div class="diff-anchors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                {#each q.diffAnchors as anchor, ai}
                  {#if ai > 0}<span class="anchor-sep">,</span>{/if}
                  <a href={diffAnchorUrl(anchor)} target="_blank">{anchor}</a>
                {/each}
              </div>
            {/if}
            <div class="answers">
              {#each q.options as opt}
                <button
                  type="button"
                  class={btnClass(i, opt.key)}
                  onclick={() => selectAnswer(i, opt.key)}
                >
                  <span class="choice-key">{opt.key}</span>
                  <span class="choice-text">{opt.text}</span>
                </button>
              {/each}
            </div>
            {#if questionStates[i].answered}
              <div class="explanation" class:good={questionStates[i].isCorrect} class:bad={!questionStates[i].isCorrect}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                <span>{q.explanation}</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      {#if answered === total && total > 0}
        <div class="result-section">
          <div class="score-card" class:pass={correct === total} class:fail={correct !== total}>
            <span class="score-value">{correct} / {total}</span>
            <span class="score-label">{correct === total ? "Perfect score" : "Questions correct"}</span>
          </div>
          <div class="stack">
            {#if correct === total}
              <button class="button primary" onclick={submitPass} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit & pass PR"}
              </button>
            {:else if session.retryMode === "maintainer_rerun"}
              <button class="button" onclick={submitPass} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit result"}
              </button>
            {:else if session.retryMode === "new_quiz"}
              <button class="button primary" onclick={submitPass} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit result"}
              </button>
              <button class="button" onclick={retryNew} disabled={retrying || submitting}>
                {retrying ? "Generating new quiz..." : "Generate new quiz"}
              </button>
            {:else}
              <button class="button primary" onclick={submitPass} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit result"}
              </button>
              <button class="button" onclick={retrySame}>Try again (same quiz)</button>
            {/if}
            {#if submitMessage}
              <p style="color: var(--gray-700); font-size: 14px; font-weight: 500;">{submitMessage}</p>
            {/if}
            <a class="button" href={prUrl}>Back to pull request</a>
          </div>
        </div>
      {/if}

      <div class="footer">Only the PR author can submit answers. All questions must be correct to pass.</div>
    {/if}
  </main>
</div>

<style>
  .brand-strip {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--line);
  }

  .brand-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--pink-400), var(--pink-600));
    display: grid;
    place-items: center;
    color: #fff;
    flex: none;
  }

  .brand-name {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--gray-800);
  }

  .hero-section {
    margin-bottom: 4px;
  }

  .hero-section p {
    margin-top: 6px;
    font-size: 15px;
    line-height: 1.6;
  }

  .hero-section p strong {
    color: var(--gray-800);
    font-weight: 600;
  }

  .passed-badge {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--good-light);
    color: var(--good);
    display: grid;
    place-items: center;
    margin-bottom: 16px;
  }

  /* ── Progress bar ── */
  .progress-bar {
    height: 6px;
    border-radius: 3px;
    background: var(--gray-200);
    margin-top: 20px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--pink-400), var(--pink-600));
    transition: width 400ms cubic-bezier(0.25, 1, 0.5, 1);
  }

  /* ── Question blocks ── */
  .question-block {
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 24px;
    background: var(--gray-50);
    transition: border-color 200ms ease, box-shadow 200ms ease;
  }

  .question-block:hover:not(.answered) {
    border-color: var(--pink-200);
  }

  .question-block.answered :global(.choice-btn) { pointer-events: none; }

  .question-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }

  .question-number {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--pink-100);
    color: var(--pink-600);
    display: grid;
    place-items: center;
    font-weight: 700;
    font-size: 15px;
    flex: none;
  }

  .question-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .question-label {
    font-size: 13px;
    color: var(--muted);
    font-weight: 500;
  }

  .question-status {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .question-status.correct { color: var(--good); }
  .question-status.wrong { color: var(--bad); }

  .question-prompt {
    color: var(--gray-800) !important;
    font-size: 15px;
    line-height: 1.6;
    margin-bottom: 6px;
  }

  .diff-anchors {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
    margin-top: 6px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }

  .diff-anchors svg { flex: none; opacity: 0.5; }
  .diff-anchors a { color: var(--accent); text-decoration: none; }
  .diff-anchors a:hover { text-decoration: underline; }
  .anchor-sep { color: var(--gray-300); }

  .answers { display: grid; gap: 8px; margin-top: 14px; }

  :global(.choice-btn) {
    display: flex;
    align-items: center;
    width: 100%;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--gray-800);
    border-radius: var(--radius-md);
    padding: 12px 16px;
    font: inherit;
    font-size: 14px;
    text-decoration: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  :global(.choice-btn:hover) {
    border-color: var(--pink-300);
    background: var(--pink-50);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(212, 80, 126, 0.08);
  }

  :global(.choice-btn.correct) {
    border-color: rgba(22, 163, 74, 0.4);
    background: var(--good-light);
    color: var(--good);
    pointer-events: none;
  }

  :global(.choice-btn.wrong) {
    border-color: rgba(229, 77, 77, 0.4);
    background: var(--bad-light);
    color: var(--bad);
    opacity: 0.7;
    pointer-events: none;
  }

  :global(.choice-btn.dimmed) {
    opacity: 0.35;
    pointer-events: none;
  }

  .choice-key {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: inline-grid;
    place-items: center;
    margin-right: 12px;
    background: var(--gray-100);
    border: 1px solid var(--gray-200);
    flex: none;
    font-weight: 700;
    font-size: 13px;
    color: var(--gray-600);
  }

  :global(.choice-btn.correct) .choice-key {
    background: rgba(22, 163, 74, 0.15);
    border-color: rgba(22, 163, 74, 0.3);
    color: var(--good);
  }

  :global(.choice-btn.wrong) .choice-key {
    background: rgba(229, 77, 77, 0.15);
    border-color: rgba(229, 77, 77, 0.3);
    color: var(--bad);
  }

  .choice-text { text-align: left; flex: 1; }

  .explanation {
    margin-top: 12px;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--line);
    font-size: 14px;
    color: var(--muted);
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: var(--surface);
  }

  .explanation svg { flex: none; margin-top: 1px; }
  .explanation span { flex: 1; }
  .explanation.good { border-color: rgba(22, 163, 74, 0.25); color: var(--good); background: var(--good-light); }
  .explanation.bad { border-color: rgba(229, 77, 77, 0.25); color: var(--bad); background: var(--bad-light); }

  /* ── Result section ── */
  .result-section { margin-top: 24px; }

  .score-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 20px;
    border-radius: var(--radius-lg);
    margin-bottom: 16px;
  }

  .score-card.pass {
    background: var(--good-light);
    border: 1px solid rgba(22, 163, 74, 0.2);
  }

  .score-card.fail {
    background: var(--bad-light);
    border: 1px solid rgba(229, 77, 77, 0.2);
  }

  .score-value {
    font-size: 28px;
    font-family: "Playfair Display", serif;
    font-weight: 700;
  }

  .score-card.pass .score-value { color: var(--good); }
  .score-card.fail .score-value { color: var(--bad); }

  .score-label {
    font-size: 13px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .score-card.pass .score-label { color: var(--good); opacity: 0.7; }
  .score-card.fail .score-label { color: var(--bad); opacity: 0.7; }
</style>
