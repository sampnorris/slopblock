<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const { session, actor, prUrl, hashes } = data;
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
    const selectedHash = hashes[`${q.id}:${key}`] ?? "";
    const correctHash = hashes[`${q.id}:correct`] ?? "";
    const isCorrect = selectedHash === correctHash;

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
    const correctHash = hashes[`${q.id}:correct`] ?? "";
    const thisHash = hashes[`${q.id}:${key}`] ?? "";
    if (key === st.selectedKey) {
      return st.isCorrect ? "choice-btn correct" : "choice-btn wrong";
    }
    if (thisHash === correctHash) return "choice-btn correct";
    return "choice-btn dimmed";
  }

  async function submitPass() {
    submitting = true;
    submitMessage = "";
    try {
      const res = await fetch(`/api/session/${session.id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "pass" })
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
</script>

<svelte:head>
  <title>slopblock - {session.status === "passed" ? "passed" : "quiz"}</title>
</svelte:head>

<main class="card">
  <div class="eyebrow">slopblock</div>

  {#if !actor}
    <!-- Login page -->
    <h1>Answer the PR quiz</h1>
    <p>Sign in with GitHub to prove you are the author of <strong>{session.repositoryOwner}/{session.repositoryName}#{session.pullNumber}</strong>.</p>
    <div class="meta">
      <div class="pill">{session.questionCount} questions</div>
      <div class="pill">Multiple choice</div>
      <div class="pill">PR author only</div>
    </div>
    <div class="stack">
      <a class="button primary" href="/auth/start?session={session.id}">Continue with GitHub</a>
    </div>

  {:else if session.status === "passed"}
    <!-- Passed page -->
    <h1>Quiz passed</h1>
    <p>{actor.login}, you passed the quiz for <strong>{session.repositoryOwner}/{session.repositoryName}#{session.pullNumber}</strong>.</p>
    <div class="stack">
      <div class="notice good">All questions answered correctly. The PR status has been updated.</div>
      <a class="button primary" href={prUrl}>Back to pull request</a>
    </div>

  {:else}
    <!-- Quiz page -->
    <h1>{session.repositoryOwner}/{session.repositoryName}#{session.pullNumber}</h1>
    <p>{session.summary ?? "Answer the questions based on the code changes in this pull request."}</p>

    <div class="meta">
      <div class="pill">Signed in as {actor.login}</div>
      <div class="pill">{answered} of {total} answered</div>
      <div class="pill"><a href="{prUrl}/files" target="_blank" style="color: inherit; text-decoration: none;">View diff</a></div>
    </div>

    <div class="progress-bar">
      <div class="progress-fill" style="width: {total > 0 ? (answered / total) * 100 : 0}%"></div>
    </div>

    <div class="stack">
      {#each questions as q, i}
        <div class="question-block" class:answered={questionStates[i].answered} id="q{i}">
          <h2>Question {i + 1} of {total}</h2>
          <p style="color: var(--text); margin-bottom: 4px;">{q.prompt}</p>
          {#if q.diffAnchors?.length}
            <div class="diff-anchors">
              Based on: {#each q.diffAnchors as anchor, ai}
                {#if ai > 0}, {/if}<a href={diffAnchorUrl(anchor)} target="_blank">{anchor}</a>
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
              {q.explanation}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if answered === total && total > 0}
      <div class="result-section">
        <div class="score" class:pass={correct === total} class:fail={correct !== total}>
          {correct} / {total} correct
        </div>
        <div class="stack">
          {#if correct === total}
            <button class="button primary" onclick={submitPass} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit & pass PR"}
            </button>
          {:else if session.retryMode === "new_quiz"}
            <button class="button" onclick={retryNew} disabled={retrying}>
              {retrying ? "Generating new quiz..." : "Generate new quiz"}
            </button>
          {:else}
            <button class="button" onclick={retrySame}>Try again (same quiz)</button>
          {/if}
          {#if submitMessage}
            <p style="color: var(--bad);">{submitMessage}</p>
          {/if}
          <a class="button" href={prUrl}>Back to pull request</a>
        </div>
      </div>
    {/if}

    <div class="footer">Only the PR author can submit answers. All questions must be correct to pass.</div>
  {/if}
</main>

<style>
  .question-block { border-top: 1px solid var(--line); padding-top: 20px; }
  .question-block.answered :global(.choice-btn) { pointer-events: none; }
  .diff-anchors { font-size: 13px; color: var(--muted); margin-top: 6px; }
  .diff-anchors a { color: var(--accent); text-decoration: none; }
  .diff-anchors a:hover { text-decoration: underline; }
  .answers { display: grid; gap: 10px; margin-top: 14px; }

  :global(.choice-btn) {
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
  :global(.choice-btn:hover) { transform: translateY(-1px); border-color: rgba(102,227,196,0.5); }
  :global(.choice-btn.correct) { border-color: var(--good); background: rgba(143, 255, 216, 0.15); pointer-events: none; }
  :global(.choice-btn.wrong) { border-color: var(--bad); background: rgba(255, 143, 143, 0.10); opacity: 0.6; pointer-events: none; }
  :global(.choice-btn.dimmed) { opacity: 0.35; pointer-events: none; }

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
  }
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

  .result-section { margin-top: 24px; }
  .score { font-size: 18px; font-weight: 600; margin: 10px 0; }
  .score.pass { color: var(--good); }
  .score.fail { color: var(--bad); }
</style>
