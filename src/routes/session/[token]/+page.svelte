<script lang="ts">
  import SlopBlockLogo from "$lib/components/SlopBlockLogo.svelte";
  import { renderMarkdown } from "$lib/markdown";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const session = $derived((data as any).session);
  const actor = $derived((data as any).actor);
  const prUrl = $derived((data as any).prUrl);
  const diffAnchorHashes = $derived((data as any).diffAnchorHashes as Record<string, string>);
  const questions = $derived(session.questions);
  const total = $derived(questions.length);
  const allowedWrongAnswers = $derived(Math.max(0, (session as any).allowedWrongAnswers ?? 0));
  const requiredCorrect = $derived(Math.max(0, total - allowedWrongAnswers));

  // Restore saved answers from server on load
  function buildInitialStates(): Array<{ answered: boolean; selectedKey: string | null; isCorrect: boolean | null }> {
    const saved = (data as any).session.savedAnswers as Record<string, string> | null;
    return (data as any).session.questions.map((q: any) => {
      const savedKey = saved?.[q.id];
      if (savedKey) {
        const isCorrect = q.correctOption === savedKey;
        return { answered: true, selectedKey: savedKey, isCorrect };
      }
      return { answered: false, selectedKey: null, isCorrect: null };
    });
  }

  let answered = $state(0);
  let correct = $state(0);
  // svelte-ignore state_referenced_locally
  let questionStates = $state(buildInitialStates());

  // Recount from restored state
  answered = questionStates.reduce((c, s) => c + (s.answered ? 1 : 0), 0);
  correct = questionStates.reduce((c, s) => c + (s.isCorrect ? 1 : 0), 0);

  let submitting = $state(false);
  let submitMessage = $state("");
  let retrying = $state(false);
  let feedbackSent = $state(false);
  let feedbackValue = $state<number | null>(null);
  /** Tracks whether the user has reviewed their wrong answers before submitting (new_quiz mode) */
  let reviewedWrongAnswers = $state(false);
  let showReloadQuizModal = $state(false);
  let reloadQuizMessage = $state("A newer quiz is available for this pull request. Reload to continue.");

  function diffAnchorUrl(anchor: string): string {
    const base = `${prUrl}/files`;
    const clean = anchor.replace(/^[+\-~]\s*/, "").split(/[:#]/)[0];
    const hash = diffAnchorHashes[clean];
    return hash ? `${base}#diff-${hash}` : base;
  }

  function promptReloadQuiz(message?: string) {
    reloadQuizMessage = message || "A newer quiz is available for this pull request. Reload to continue.";
    submitMessage = "";
    showReloadQuizModal = true;
  }

  async function loadLatestQuiz() {
    window.location.reload();
  }

  /** Save current answers to server */
  async function saveAnswersToServer(): Promise<boolean> {
    const answers = selectedAnswers();
    try {
      const res = await fetch(`/api/session/${session.id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "save_answers",
          answers,
          expectedHeadSha: session.headSha,
        }),
      });

      if (res.ok) return true;

      const json = await res.json().catch(() => null);
      if (res.status === 409 && json?.drifted) {
        promptReloadQuiz(json.message);
      }
    } catch {
      // best effort
    }

    return false;
  }

  async function selectAnswer(qIndex: number, key: string) {
    if (showReloadQuizModal || questionStates[qIndex].answered) return;
    const q = questions[qIndex];
    const isCorrect = q.correctOption === key;
    questionStates[qIndex] = { answered: true, selectedKey: key, isCorrect };
    answered++;
    if (isCorrect) correct++;

    // Auto-save to server on each answer
    await saveAnswersToServer();

    if (showReloadQuizModal) return;

    if (answered < total) {
      setTimeout(() => {
        const next = document.getElementById(`q${qIndex + 1}`);
        next?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }

  function btnClass(qIndex: number, key: string): string {
    if (showReloadQuizModal) return "choice-btn dimmed";
    const st = questionStates[qIndex];
    if (!st.answered) return "choice-btn";
    const q = questions[qIndex];
    if (key === st.selectedKey) return st.isCorrect ? "choice-btn correct" : "choice-btn wrong";
    if (key === q.correctOption) return "choice-btn correct";
    return "choice-btn dimmed";
  }

  function selectedAnswers(): Record<string, string> {
    return Object.fromEntries(questions.map((question: any, index: number) => [question.id, questionStates[index].selectedKey ?? ""]));
  }

  function clearIncorrectAnswers() {
    if (showReloadQuizModal) return;
    let firstIncorrect = -1;
    for (let i = 0; i < questionStates.length; i += 1) {
      const state = questionStates[i];
      if (state.answered && state.isCorrect === false) {
        questionStates[i] = { answered: false, selectedKey: null, isCorrect: null };
        if (firstIncorrect === -1) firstIncorrect = i;
      }
    }

    answered = questionStates.reduce((count, state) => count + (state.answered ? 1 : 0), 0);
    correct = questionStates.reduce((count, state) => count + (state.isCorrect ? 1 : 0), 0);

    // Save the cleared state to server
    void saveAnswersToServer();

    if (firstIncorrect >= 0) {
      setTimeout(() => {
        document.getElementById(`q${firstIncorrect}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }

  // ── same_quiz mode: submit only when passing ──
  async function submitPass() {
    if (correct < requiredCorrect) return;
    submitting = true; submitMessage = "";
    try {
      const res = await fetch(`/api/session/${session.id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "pass",
          answers: selectedAnswers(),
          expectedHeadSha: session.headSha,
        }),
      });
      const json = await res.json();
      if (json.ok && json.passed) {
        window.location.reload();
      } else if (res.status === 409 && json.drifted) {
        promptReloadQuiz(json.message);
      } else {
        submitMessage = json.message || "Submission failed. Fix your answers or generate a new quiz.";
      }
    } catch { submitMessage = "Network error, try again"; }
    finally { submitting = false; }
  }

  // ── new_quiz mode: submit (only callable when passing + reviewed) ──
  async function submitPassNewQuizMode() {
    submitting = true; submitMessage = "";
    try {
      const res = await fetch(`/api/session/${session.id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "pass",
          answers: selectedAnswers(),
          expectedHeadSha: session.headSha,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        if (json.passed) {
          window.location.reload();
        } else if (res.status === 409 && json.drifted) {
          promptReloadQuiz(json.message);
        } else {
          submitMessage = json.message || "Unexpected: server did not pass.";
        }
      }
      else if (res.status === 409 && json.drifted) {
        promptReloadQuiz(json.message);
      } else { submitMessage = json.message || "Unknown error"; }
    } catch { submitMessage = "Network error, try again"; }
    finally { submitting = false; }
  }

  async function retryNew() {
    retrying = true; submitMessage = "";
    try {
      const res = await fetch(`/api/session/${session.id}/answer`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "retry_new" }) });
      const json = await res.json();
      if (json.ok) { window.location.reload(); } else { submitMessage = json.message || "Unknown error"; }
    } catch { submitMessage = "Network error, try again"; }
    finally { retrying = false; }
  }

  function retrySame() {
    clearIncorrectAnswers();
    submitMessage = "Incorrect answers were cleared. Update them and submit again.";
  }

  /** new_quiz mode: user acknowledges wrong answers, then can submit */
  function acknowledgeWrongAnswers() {
    reviewedWrongAnswers = true;
  }

  async function submitFeedback(value: number) {
    feedbackValue = value;
    feedbackSent = true;
    try {
      await fetch(`/api/session/${session.id}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ value })
      });
    } catch { /* best effort */ }
  }

  let progressPct = $derived(total > 0 ? (answered / total) * 100 : 0);
  let isPassing = $derived(correct >= requiredCorrect);
  let wrongCount = $derived(answered - correct);
</script>

<svelte:head>
  <title>SlopBlock - {session.status === "passed" ? "passed" : "quiz"}</title>
</svelte:head>

<div class="centered-layout">
  <main class="card">
    <div class="brand-strip">
      <div class="brand-icon"><SlopBlockLogo width={18} height={18} /></div>
      <span class="brand-name">SlopBlock</span>
    </div>

    {#if !actor}
      <div class="hero-section">
        <h1>Answer the PR quiz</h1>
        <p>Sign in with GitHub to prove you are the author of <strong>{session.repositoryOwner}/{session.repositoryName}#{session.pullNumber}</strong>.</p>
      </div>
      <div class="meta">
        <div class="pill pink">{session.questionCount} questions</div>
        <div class="pill">Multiple choice</div>
        <div class="pill">PR author only</div>
      </div>
      <div class="stack" style="margin-top: 24px;">
        <a class="button primary" href="/auth/start?session={session.id}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          Continue with GitHub
        </a>
      </div>

    {:else if session.status === "passed"}
      <div class="hero-section">
        <div class="passed-badge">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h1>Quiz passed</h1>
        <p>{actor.login}, you passed the quiz for <strong>{session.repositoryOwner}/{session.repositoryName}#{session.pullNumber}</strong>.</p>
      </div>
      <div class="stack">
        <div class="notice good">Passing score reached. The PR status has been updated.</div>
        <a class="button primary" href={prUrl}>Back to pull request</a>
      </div>

      <div class="feedback-section">
        {#if feedbackSent}
          <p class="feedback-thanks">Thanks for your feedback{feedbackValue === 1 ? " — glad it was helpful!" : "."}</p>
        {:else}
          <p class="feedback-label">Was this quiz helpful?</p>
          <div class="feedback-buttons">
            <button class="feedback-btn up" onclick={() => submitFeedback(1)} aria-label="Thumbs up">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
            </button>
            <button class="feedback-btn down" onclick={() => submitFeedback(0)} aria-label="Thumbs down">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
            </button>
          </div>
        {/if}
      </div>

    {:else}
      <div class="hero-section">
        <h1>{session.repositoryOwner}/{session.repositoryName}#{session.pullNumber}</h1>
        <p>{session.summary ?? "Answer the questions based on the code changes in this pull request."}</p>
      </div>

      <div class="meta">
        <div class="pill">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0113 0"/></svg>
          {actor.login}
        </div>
        <div class="pill pink">{answered} of {total}</div>
        {#if session.generationModel}<div class="pill">Created by: <code>{session.generationModel}</code></div>{/if}
        {#if session.validationModel}<div class="pill">Validated by: <code>{session.validationModel}</code></div>{/if}
        <div class="pill">
          <a href="{prUrl}/files" target="_blank" style="color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            View diff
          </a>
        </div>
      </div>

      <div class="progress-bar"><div class="progress-fill" style="width: {progressPct}%"></div></div>

      <div class="stack">
        {#each questions as q, i (q.id)}
          <div class="question-block" class:answered={questionStates[i].answered} id="q{i}">
            <div class="question-header">
              <span class="question-number">{i + 1}</span>
              <div class="question-meta">
                <span class="question-label">Question {i + 1} of {total}</span>
                {#if questionStates[i].answered}
                  {#if questionStates[i].isCorrect}<span class="question-status correct">Correct</span>
                  {:else}<span class="question-status wrong">Incorrect</span>{/if}
                {/if}
              </div>
            </div>
            <div class="question-prompt markdown">{@html renderMarkdown(q.prompt)}</div>
            {#if q.diffAnchors?.length}
              <div class="diff-anchors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                {#each q.diffAnchors as anchor, ai (`${anchor}-${ai}`)}
                  {#if ai > 0}<span class="anchor-sep">,</span>{/if}
                  <a href={diffAnchorUrl(anchor)} target="_blank">{anchor}</a>
                {/each}
              </div>
            {/if}
            <div class="answers">
              {#each q.options as opt (opt.key)}
                <button type="button" class={btnClass(i, opt.key)} onclick={() => selectAnswer(i, opt.key)}>
                  <span class="choice-key">{opt.key}</span>
                  <span class="choice-text choice-markdown">{@html renderMarkdown(opt.text)}</span>
                </button>
              {/each}
            </div>
            {#if questionStates[i].answered}
              <div class="explanation" class:good={questionStates[i].isCorrect} class:bad={!questionStates[i].isCorrect}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                <span class="markdown">{@html renderMarkdown(q.explanation)}</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      {#if answered === total && total > 0}
        <div class="result-section">
            <div class="score-card" class:pass={isPassing} class:fail={!isPassing}>
              <span class="score-value">{correct} / {total}</span>
              <span class="score-label">{isPassing ? "Passing score" : "Questions correct"}</span>
            </div>
            <div class="stack">

            {#if session.retryMode === "same_quiz"}
              <!-- same_quiz mode:
                   - No submit until passing score
                   - Even with passing score, allow going back to correct answers before submitting
                   - Submit only when passing -->
              {#if isPassing}
                {#if wrongCount > 0}
                  <div class="notice">You have a passing score, but you can correct your wrong answers before submitting.</div>
                  <button class="button" onclick={retrySame}>Correct wrong answers</button>
                {/if}
                <button class="button primary" onclick={submitPass} disabled={submitting}>{submitting ? "Submitting..." : "Submit & pass PR"}</button>
              {:else}
                <div class="notice">You need {requiredCorrect} correct answers to pass. Correct your wrong answers and try again.</div>
                <button class="button primary" onclick={retrySame}>Correct wrong answers</button>
              {/if}

            {:else if session.retryMode === "new_quiz"}
              <!-- new_quiz mode:
                   - If passing: show wrong answers, let user review, then allow submit
                   - If not passing: no submit, must generate new quiz -->
              {#if isPassing}
                {#if wrongCount > 0 && !reviewedWrongAnswers}
                  <div class="notice">You passed, but review your incorrect answers before submitting.</div>
                  <button class="button primary" onclick={acknowledgeWrongAnswers}>I've reviewed my answers</button>
                {:else}
                  <button class="button primary" onclick={submitPassNewQuizMode} disabled={submitting}>{submitting ? "Submitting..." : "Submit & pass PR"}</button>
                {/if}
              {:else}
                <div class="notice">You did not reach the passing score. Generate a new quiz to try again.</div>
                <button class="button primary" onclick={retryNew} disabled={retrying || submitting}>{retrying ? "Generating new quiz..." : "Generate new quiz"}</button>
              {/if}

            {:else if session.retryMode === "maintainer_rerun"}
              {#if isPassing}
                <button class="button primary" onclick={submitPass} disabled={submitting}>{submitting ? "Submitting..." : "Submit & pass PR"}</button>
              {:else}
                <div class="notice">You did not reach the passing score. A maintainer must re-run the quiz.</div>
              {/if}


            {/if}

            {#if submitMessage}<p style="color: var(--gray-700); font-size: 13px; font-weight: 500;">{submitMessage}</p>{/if}
            <a class="button" href={prUrl}>Back to pull request</a>
          </div>

          <div class="feedback-section">
            {#if feedbackSent}
              <p class="feedback-thanks">Thanks for your feedback{feedbackValue === 1 ? " — glad it was helpful!" : "."}</p>
            {:else}
              <p class="feedback-label">Was this quiz helpful?</p>
              <div class="feedback-buttons">
                <button class="feedback-btn up" onclick={() => submitFeedback(1)} aria-label="Thumbs up">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                </button>
                <button class="feedback-btn down" onclick={() => submitFeedback(0)} aria-label="Thumbs down">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <div class="footer">Only the PR author can submit answers. {allowedWrongAnswers === 0 ? "All questions must be correct to pass." : `Up to ${allowedWrongAnswers} wrong ${allowedWrongAnswers === 1 ? "answer is" : "answers are"} allowed.`}</div>
    {/if}
  </main>
</div>

{#if showReloadQuizModal}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="quiz-modal-overlay"
    onkeydown={(e) => {
      if (e.key === "Escape") loadLatestQuiz();
    }}
  >
    <div class="quiz-modal-card" role="dialog" aria-modal="true" aria-labelledby="reload-quiz-title">
      <div class="quiz-modal-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
      </div>
      <p class="quiz-modal-eyebrow">New quiz ready</p>
      <h2 id="reload-quiz-title" class="quiz-modal-title">This quiz is out of date</h2>
      <p class="quiz-modal-desc">{reloadQuizMessage}</p>
      <div class="quiz-modal-footer">
        <button class="quiz-modal-btn-primary" onclick={loadLatestQuiz}>Load new quiz</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .brand-strip {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--line);
  }
  .brand-icon {
    width: 30px; height: 30px; border-radius: 50%;
    background: linear-gradient(135deg, var(--pink-400), var(--pink-600));
    display: grid; place-items: center; color: #fff; flex: none;
  }
  .brand-name { font: 600 14px/1 "DM Sans", sans-serif; color: #fff; letter-spacing: -0.01em; }

  .hero-section { margin-bottom: 4px; }
  .hero-section p { margin-top: 6px; font-size: 14px; line-height: 1.6; }
  .hero-section p strong { color: #fff; font-weight: 600; }

  .passed-badge {
    width: 48px; height: 48px; border-radius: 50%;
    background: var(--good-light); color: var(--good);
    display: grid; place-items: center; margin-bottom: 14px;
  }

  /* Progress bar */
  .progress-bar { height: 4px; border-radius: 2px; background: var(--gray-200); margin-top: 16px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--pink-400), var(--pink-600)); transition: width 400ms cubic-bezier(0.25, 1, 0.5, 1); }

  /* Question blocks */
  .question-block {
    border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 20px;
    background: var(--gray-50); transition: border-color 200ms ease;
  }
  .question-block:hover:not(.answered) { border-color: rgba(232, 112, 154, 0.2); }
  .question-block.answered :global(.choice-btn) { pointer-events: none; }

  .question-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .question-number {
    width: 32px; height: 32px; border-radius: 50%;
    background: rgba(232, 112, 154, 0.12); color: var(--accent);
    display: grid; place-items: center; font: 700 13px/1 "DM Mono", monospace; flex: none;
  }
  .question-meta { display: flex; flex-direction: column; gap: 2px; }
  .question-label { font: 500 11px/1 "DM Mono", monospace; color: var(--muted); letter-spacing: 0.02em; }
  .question-status { font: 600 11px/1 "DM Mono", monospace; text-transform: uppercase; letter-spacing: 0.04em; }
  .question-status.correct { color: var(--good); }
  .question-status.wrong { color: var(--bad); }

  .question-prompt { color: var(--gray-800) !important; font-size: 14px; line-height: 1.6; margin-bottom: 4px; }

  /* Markdown content styles */
  :global(.markdown p, .choice-markdown p) { margin: 0; color: inherit; }
  :global(.markdown p + p, .choice-markdown p + p) { margin-top: 8px; }
  :global(.markdown ul, .markdown ol, .choice-markdown ul, .choice-markdown ol) { margin: 6px 0 0 18px; padding: 0; }
  :global(.markdown li + li, .choice-markdown li + li) { margin-top: 3px; }
  :global(.markdown code, .choice-markdown code) {
    font-family: "DM Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.9em; background: rgba(232, 112, 154, 0.08); padding: 0.1em 0.35em; border-radius: 4px;
  }
  :global(.markdown strong, .choice-markdown strong) { font-weight: 600; color: inherit; }
  :global(.markdown em, .choice-markdown em) { font-style: italic; }

  .diff-anchors {
    display: flex; align-items: center; gap: 6px;
    font: 400 12px/1 "DM Mono", monospace; color: var(--muted);
    margin-top: 4px; margin-bottom: 4px; flex-wrap: wrap;
  }
  .diff-anchors svg { flex: none; opacity: 0.5; }
  .diff-anchors a { color: var(--accent); text-decoration: none; }
  .diff-anchors a:hover { text-decoration: underline; }
  .anchor-sep { color: var(--gray-300); }

  .answers { display: grid; gap: 6px; margin-top: 12px; }

  :global(.choice-btn) {
    display: flex; align-items: center; width: 100%;
    border: 1px solid var(--line); background: var(--surface); color: var(--text);
    border-radius: var(--radius-md); padding: 10px 14px;
    font: inherit; font-size: 13px; text-decoration: none; cursor: pointer;
    transition: all 160ms ease;
  }
  :global(.choice-btn:hover) { border-color: rgba(232, 112, 154, 0.3); background: rgba(232, 112, 154, 0.04); transform: translateY(-1px); }
  :global(.choice-btn.correct) { border-color: rgba(74, 222, 128, 0.3); background: var(--good-light); color: var(--good); pointer-events: none; }
  :global(.choice-btn.wrong) { border-color: rgba(239, 68, 68, 0.3); background: var(--bad-light); color: var(--bad); opacity: 0.7; pointer-events: none; }
  :global(.choice-btn.dimmed) { opacity: 0.25; pointer-events: none; }

  .choice-key {
    width: 28px; height: 28px; border-radius: 8px; display: inline-grid; place-items: center;
    margin-right: 10px; background: var(--gray-100); border: 1px solid var(--line);
    flex: none; font: 700 12px/1 "DM Mono", monospace; color: var(--muted);
  }
  :global(.choice-btn.correct) .choice-key { background: rgba(74, 222, 128, 0.1); border-color: rgba(74, 222, 128, 0.2); color: var(--good); }
  :global(.choice-btn.wrong) .choice-key { background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); color: var(--bad); }
  .choice-text { text-align: left; flex: 1; }

  .explanation {
    margin-top: 10px; padding: 10px 14px; border-radius: var(--radius-md);
    border: 1px solid var(--line); font-size: 13px; color: var(--muted);
    display: flex; align-items: flex-start; gap: 8px; background: var(--surface);
  }
  .explanation svg { flex: none; margin-top: 1px; }
  .explanation span { flex: 1; }
  .explanation.good { border-color: rgba(74, 222, 128, 0.2); color: var(--good); background: var(--good-light); }
  .explanation.bad { border-color: rgba(239, 68, 68, 0.2); color: var(--bad); background: var(--bad-light); }

  /* Notices */
  .notice {
    padding: 12px 16px; border-radius: var(--radius-md);
    border: 1px solid var(--line); font-size: 13px; font-weight: 500;
    color: var(--muted); background: var(--gray-50); line-height: 1.5;
  }
  .notice.good { color: var(--good); border-color: rgba(74, 222, 128, 0.25); background: var(--good-light); }

  /* Result */
  .result-section { margin-top: 20px; }
  .score-card {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 18px; border-radius: var(--radius-lg); margin-bottom: 14px;
  }
  .score-card.pass { background: var(--good-light); border: 1px solid rgba(74, 222, 128, 0.15); }
  .score-card.fail { background: var(--bad-light); border: 1px solid rgba(239, 68, 68, 0.15); }
  .score-value { font: 700 26px/1 "Playfair Display", serif; }
  .score-card.pass .score-value { color: var(--good); }
  .score-card.fail .score-value { color: var(--bad); }
  .score-label { font: 500 10px/1 "DM Mono", monospace; text-transform: uppercase; letter-spacing: 0.08em; }
  .score-card.pass .score-label { color: var(--good); opacity: 0.7; }
  .score-card.fail .score-label { color: var(--bad); opacity: 0.7; }

  /* Feedback */
  .feedback-section {
    margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line);
    display: flex; flex-direction: column; align-items: center; gap: 8px;
  }
  .feedback-label {
    font: 500 12px/1 "DM Mono", monospace; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .feedback-buttons { display: flex; gap: 8px; }
  .feedback-btn {
    width: 36px; height: 36px; border-radius: 10px;
    border: 1px solid var(--line); background: var(--surface);
    color: var(--muted); cursor: pointer; display: grid; place-items: center;
    transition: all 160ms ease;
  }
  .feedback-btn:hover { transform: translateY(-1px); }
  .feedback-btn.up:hover { border-color: rgba(74, 222, 128, 0.3); color: var(--good); background: var(--good-light); }
  .feedback-btn.down:hover { border-color: rgba(239, 68, 68, 0.3); color: var(--bad); background: var(--bad-light); }
  .feedback-thanks {
    font: 500 13px/1.4 "DM Sans", sans-serif; color: var(--muted);
  }

  .quiz-modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(8px);
    display: grid; place-items: center;
    padding: 20px;
  }
  .quiz-modal-card {
    width: 100%; max-width: 420px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    padding: 28px;
    text-align: center;
    box-shadow:
      0 0 0 1px rgba(232, 112, 154, 0.08),
      0 24px 80px rgba(0, 0, 0, 0.5),
      0 0 120px rgba(232, 112, 154, 0.06);
  }
  .quiz-modal-icon {
    width: 48px; height: 48px; border-radius: 50%;
    margin: 0 auto 14px;
    display: grid; place-items: center;
    color: var(--accent);
    background: linear-gradient(135deg, rgba(232, 112, 154, 0.15), rgba(232, 112, 154, 0.06));
    border: 1px solid rgba(232, 112, 154, 0.2);
  }
  .quiz-modal-eyebrow {
    font: 500 10px/1 "DM Mono", monospace;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--accent); margin-bottom: 8px;
  }
  .quiz-modal-title {
    font: 700 22px/1.15 "Playfair Display", serif;
    letter-spacing: -0.02em; color: #fff;
    margin-bottom: 10px;
  }
  .quiz-modal-desc {
    font-size: 13px; line-height: 1.6; color: var(--muted);
    margin: 0;
  }
  .quiz-modal-footer {
    margin-top: 20px;
    display: flex;
  }
  .quiz-modal-btn-primary {
    flex: 1; padding: 10px 16px;
    border-radius: var(--radius-md);
    font: 600 13px/1 "DM Sans", sans-serif;
    text-align: center; cursor: pointer;
    border: none;
    background: linear-gradient(135deg, var(--pink-400), var(--pink-600));
    color: #fff;
    box-shadow: 0 0 0 1px rgba(232, 112, 154, 0.3), 0 2px 12px rgba(232, 112, 154, 0.2);
    transition: all 160ms ease;
  }
  .quiz-modal-btn-primary:hover {
    box-shadow: 0 0 0 1px rgba(232, 112, 154, 0.5), 0 4px 20px rgba(232, 112, 154, 0.3);
    transform: translateY(-1px);
  }
</style>
