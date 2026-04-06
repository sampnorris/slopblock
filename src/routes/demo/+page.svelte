<script lang="ts">
  import SlopBlockLogo from "$lib/components/SlopBlockLogo.svelte";
  import { renderMarkdown } from "$lib/markdown";
  import { publicDemoQuiz } from "$lib/demo-quiz";

  const questions = publicDemoQuiz.questions;
  const total = questions.length;

  let answered = $state(0);
  let correct = $state(0);
  let passed = $state(false);
  let attempts = $state(0);
  let submitMessage = $state("");
  let questionStates = $state<Array<{ answered: boolean; selectedKey: string | null; isCorrect: boolean | null }>>(
    questions.map(() => ({ answered: false, selectedKey: null, isCorrect: null }))
  );

  let progressPct = $derived(total > 0 ? (answered / total) * 100 : 0);

  function selectAnswer(qIndex: number, key: string) {
    if (questionStates[qIndex].answered) return;

    const q = questions[qIndex];
    const isCorrect = q.correctOption === key;

    questionStates[qIndex] = { answered: true, selectedKey: key, isCorrect };
    answered += 1;
    if (isCorrect) correct += 1;

    if (answered < total) {
      setTimeout(() => {
        const next = document.getElementById(`demo-q${qIndex + 1}`);
        next?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 250);
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

  function submitDemo() {
    attempts += 1;

    if (correct === total) {
      passed = true;
      submitMessage = "";
      return;
    }

    submitMessage = `Demo attempt ${attempts}. Score: ${correct} / ${total}. In the real app, this PR would stay blocked until the author answers every question correctly.`;
  }

  function diffLineClass(line: string): string {
    if (line.startsWith("diff --git") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++")) return "diff-meta";
    if (line.startsWith("@@")) return "diff-hunk";
    if (line.startsWith("+")) return "diff-add";
    if (line.startsWith("-")) return "diff-del";
    return "diff-ctx";
  }

  function diffPrefix(line: string): string {
    if (line.startsWith("diff --git") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++") || line.startsWith("@@")) return "";
    if (line.startsWith("+")) return "+";
    if (line.startsWith("-")) return "-";
    return " ";
  }

  function diffContent(line: string): string {
    if (line.startsWith("diff --git") || line.startsWith("@@")) return line;
    if (line.startsWith("+") || line.startsWith("-")) return line.slice(1);
    if (line.startsWith(" ")) return line.slice(1);
    return line;
  }

  function retryDemo() {
    answered = 0;
    correct = 0;
    passed = false;
    submitMessage = "";
    questionStates = questions.map(() => ({ answered: false, selectedKey: null, isCorrect: null }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
</script>

<svelte:head>
  <title>SlopBlock - public demo</title>
</svelte:head>

<div class="centered-layout">
  <main class="card demo-card">
    <div class="brand-strip">
      <div class="brand-icon">
        <SlopBlockLogo width={20} height={20} />
      </div>
      <span class="brand-name">SlopBlock</span>
      <div class="pill pink">Public demo</div>
    </div>

    {#if passed}
      <div class="hero-section">
        <div class="passed-badge">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h1>Demo quiz passed</h1>
        <p>You answered all questions correctly for <strong>{publicDemoQuiz.repo}</strong>.</p>
      </div>

      <div class="stack">
        <div class="notice good">This is the same interaction pattern the real app uses, except the production flow writes a GitHub status check for the PR author.</div>
        <div class="action-row">
          <button class="button primary" type="button" onclick={retryDemo}>Try the demo again</button>
          <a class="button" href="/">Back to homepage</a>
        </div>
      </div>
    {:else}
      <div class="hero-section">
        <div class="eyebrow">Working Demo</div>
        <h1>{publicDemoQuiz.title}</h1>
        <p>{publicDemoQuiz.summary}</p>
      </div>

      <div class="meta">
        <div class="pill">{publicDemoQuiz.repo}</div>
        <div class="pill pink">{total} questions</div>
        <div class="pill">Multiple choice</div>
        <div class="pill">Immediate grading</div>
      </div>

      <div class="diff-card">
        <div class="diff-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Diff
        </div>
        <div class="diff-block">{#each publicDemoQuiz.diff as line}<div class="diff-line {diffLineClass(line)}"><span class="diff-prefix">{diffPrefix(line)}</span><span>{diffContent(line)}</span></div>{/each}</div>
      </div>

      <div class="progress-bar">
        <div class="progress-fill" style="width: {progressPct}%"></div>
      </div>

      <div class="stack">
        {#each questions as q, i}
          <div class="question-block" class:answered={questionStates[i].answered} id="demo-q{i}">
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

            <div class="question-prompt markdown">{@html renderMarkdown(q.prompt)}</div>

            <div class="diff-anchors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {#each q.diffAnchors as anchor, ai}
                {#if ai > 0}<span class="anchor-sep">,</span>{/if}
                <span class="anchor-text">{anchor}</span>
              {/each}
            </div>

            <div class="answers">
              {#each q.options as opt}
                <button type="button" class={btnClass(i, opt.key)} onclick={() => selectAnswer(i, opt.key)}>
                  <span class="choice-key">{opt.key}</span>
                  <span class="choice-text choice-markdown">{@html renderMarkdown(opt.text)}</span>
                </button>
              {/each}
            </div>

            {#if questionStates[i].answered}
              <div class="explanation" class:good={questionStates[i].isCorrect} class:bad={!questionStates[i].isCorrect}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                <span class="markdown">{@html renderMarkdown(q.explanation)}</span>
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
            <div class="action-row">
              <button class="button primary" type="button" onclick={submitDemo}>
                {correct === total ? "Submit demo and pass" : "Submit demo result"}
              </button>
              <button class="button" type="button" onclick={retryDemo}>Try again</button>
            </div>

            {#if submitMessage}
              <div class="notice bad">{submitMessage}</div>
            {/if}

            <div class="action-row">
              <a class="button" href="/">Back to homepage</a>
              <a class="button" href={publicDemoQuiz.installUrl} target="_blank" rel="noreferrer">Install SlopBlock</a>
            </div>
          </div>
        </div>
      {/if}

      <div class="footer">Public demo only: no GitHub auth, no PR status writeback. The real app limits submissions to the PR author and updates the required check on the pull request.</div>
    {/if}
  </main>
</div>

<style>
  .demo-card {
    width: min(860px, 100%);
  }

  .brand-strip {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
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
    margin-bottom: 8px;
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

  .diff-card {
    margin-top: 20px;
    border: 1px solid #2d2d3a;
    border-radius: var(--radius-xl);
    background: #1a1b26;
    color: #c0caf5;
    overflow: hidden;
  }

  .diff-label {
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    font: 700 11px/1 "DM Mono", ui-monospace, monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #bb9af7;
    display: flex; align-items: center; gap: 8px;
  }
  .diff-label svg { opacity: 0.5; }

  .diff-block {
    margin: 0;
    padding: 4px 0;
    overflow-x: auto;
    font: 400 13px/1 "DM Mono", ui-monospace, monospace;
  }

  .diff-line {
    display: flex;
    padding: 2px 16px;
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.65;
  }

  .diff-prefix {
    flex: none;
    width: 18px;
    text-align: center;
    user-select: none;
    opacity: 0.5;
  }

  .diff-line.diff-ctx { color: rgba(192, 202, 245, 0.5); }
  .diff-line.diff-add { color: #9ece6a; background: rgba(158, 206, 106, 0.08); }
  .diff-line.diff-del { color: #f7768e; background: rgba(247, 118, 142, 0.08); }
  .diff-line.diff-hunk { color: #7aa2f7; font-style: italic; opacity: 0.7; }
  .diff-line.diff-meta { color: rgba(192, 202, 245, 0.3); font-size: 12px; }

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

  .question-block.answered :global(.choice-btn) {
    pointer-events: none;
  }

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

  .question-status.correct {
    color: var(--good);
  }

  .question-status.wrong {
    color: var(--bad);
  }

  .question-prompt {
    color: var(--gray-800);
    font-size: 15px;
    line-height: 1.6;
    margin-bottom: 6px;
  }

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
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
    margin-top: 6px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }

  .diff-anchors svg {
    flex: none;
    opacity: 0.5;
  }

  .anchor-sep {
    color: var(--gray-300);
  }

  .anchor-text {
    color: var(--accent);
  }

  .answers {
    display: grid;
    gap: 8px;
    margin-top: 14px;
  }

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

  .choice-text {
    text-align: left;
    flex: 1;
  }

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

  .explanation svg {
    flex: none;
    margin-top: 1px;
  }

  .explanation span {
    flex: 1;
  }

  .explanation.good {
    border-color: rgba(22, 163, 74, 0.25);
    color: var(--good);
    background: var(--good-light);
  }

  .explanation.bad {
    border-color: rgba(229, 77, 77, 0.25);
    color: var(--bad);
    background: var(--bad-light);
  }

  .result-section {
    margin-top: 24px;
  }

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

  .score-card.pass .score-value {
    color: var(--good);
  }

  .score-card.fail .score-value {
    color: var(--bad);
  }

  .score-label {
    font-size: 13px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .score-card.pass .score-label {
    color: var(--good);
    opacity: 0.7;
  }

  .score-card.fail .score-label {
    color: var(--bad);
    opacity: 0.7;
  }

  .action-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  @media (max-width: 720px) {
    .action-row {
      grid-template-columns: 1fr;
    }

    .question-block {
      padding: 18px;
    }
  }
</style>
