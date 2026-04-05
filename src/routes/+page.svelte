<script lang="ts">
  import SlopBlockLogo from "$lib/components/SlopBlockLogo.svelte";
  import { publicDemoQuiz } from "$lib/demo-quiz";

  const steps = [
    "SlopBlock watches a pull request when it opens, updates, or becomes ready for review.",
    "It decides whether the diff is trivial enough to skip or worth turning into a quiz.",
    "The PR author answers multiple-choice questions tied directly to the changed code.",
    "Passing the quiz updates the required status check so the PR can merge.",
  ];
</script>

<svelte:head>
  <title>SlopBlock</title>
</svelte:head>

<!-- Mobile top bar (hidden on desktop where sidebar is visible) -->
<header class="mobile-topbar">
  <div class="mobile-brand">
    <div class="mobile-logo">
      <SlopBlockLogo width={20} height={20} />
    </div>
    <span class="mobile-brand-name">SlopBlock</span>
  </div>
  <nav class="mobile-nav">
    <a href="/demo" class="mobile-nav-link">Demo</a>
    <a href="/settings" class="mobile-nav-link">Settings</a>
  </nav>
</header>

<div class="landing-shell">
  <!-- ── Hero ────────────────────────── -->
  <section class="hero card">
    <div class="hero-copy">
      <div class="hero-brand">
        <div class="hero-logo">
          <SlopBlockLogo width={28} height={28} />
        </div>
        <span class="hero-name">SlopBlock</span>
      </div>

      <div class="eyebrow">Diff-grounded PR gatekeeping</div>
      <h1>Make authors prove they understand their pull request.</h1>
      <p class="hero-text">
        SlopBlock is a GitHub App that blocks merges behind a short quiz built from the diff.
        It skips obvious changes, asks focused questions for risky ones, and keeps the status
        check tied to actual code comprehension instead of vibes.
      </p>

      <div class="meta hero-meta">
        <div class="pill pink">GitHub App</div>
        <div class="pill">PR author only</div>
        <div class="pill">Required status check</div>
      </div>

      <div class="hero-actions">
        <a class="button primary hero-button" href="https://github.com/apps/slopblock-quiz/installations/new" target="_blank" rel="noreferrer">
          Install SlopBlock
        </a>
        <a class="button hero-button" href="/demo">
          Try Public Demo
        </a>
        <a class="button hero-button" href="/settings">
          Open Settings
        </a>
      </div>
    </div>

    <div class="hero-panel">
      <div class="signal-card">
        <div class="signal-row">
          <span class="signal-label">Status check</span>
          <span class="signal-badge">Awaiting author quiz</span>
        </div>
        <p>
          Instead of approving a merge because the author opened the PR, SlopBlock asks them to
          explain the changed code in context.
        </p>
      </div>

      <div class="signal-list">
        <div class="signal-item">
          <span class="signal-index">01</span>
          <span>Reads the diff</span>
        </div>
        <div class="signal-item">
          <span class="signal-index">02</span>
          <span>Generates targeted questions</span>
        </div>
        <div class="signal-item">
          <span class="signal-index">03</span>
          <span>Passes only on fully correct answers</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ── How it works ─────────────────── -->
  <section class="section-block">
    <div class="section-heading">
      <div class="eyebrow">How it works</div>
      <h2>One short flow from PR open to merge</h2>
    </div>

    <div class="card-grid steps-grid">
      {#each steps as step, index}
        <article class="card step-card">
          <div class="step-number">0{index + 1}</div>
          <p>{step}</p>
        </article>
      {/each}
    </div>
  </section>

  <!-- ── Public Example Quiz ──────────── -->
  <section class="section-block">
    <div class="section-heading">
      <div class="eyebrow">Public Example Quiz</div>
      <h2>Try the quiz flow without installing anything</h2>
      <p>
        The public demo uses a realistic diff and the same interaction pattern as the real app:
        answer each question, get graded immediately, then submit the result.
      </p>
    </div>

    <div class="card public-example-card">
      <div class="example-header">
        <div class="example-header-text">
          <div class="question-chip">{publicDemoQuiz.repo}</div>
          <h3 class="example-title">{publicDemoQuiz.title}</h3>
          <p>{publicDemoQuiz.summary}</p>
        </div>
        <a class="button demo-link" href="/demo">Launch demo</a>
      </div>

      <div class="diff-card">
        <div class="diff-label">Changed lines</div>
        <pre class="diff-block">{publicDemoQuiz.diff.join("\n")}</pre>
      </div>

      <div class="examples-grid">
      {#each publicDemoQuiz.questions as question, index}
        <article class="card example-card">
          <div class="example-topline">
            <span class="question-chip">Question {index + 1}</span>
            <span class="example-tag">Multiple choice</span>
          </div>

          <h3>{question.prompt}</h3>

          <div class="option-list">
            {#each question.options as option, optionIndex}
              <div class:correct-option={optionIndex === 0} class="option-row">
                <span class="option-key">{option.key}</span>
                <span>{option.text}</span>
              </div>
            {/each}
          </div>

          <div class="notice good example-answer">Correct answer: {question.explanation}</div>
        </article>
      {/each}
      </div>

      <div class="demo-cta-row">
        <a class="button primary" href="/demo">Open interactive demo</a>
      </div>
    </div>
  </section>

  <!-- ── CTA ──────────────────────────── -->
  <section class="card cta-card">
    <div class="cta-copy">
      <div class="eyebrow">Why teams use it</div>
      <h2>Catch cargo-culted changes before they merge</h2>
      <p>
        SlopBlock gives maintainers a lightweight gate when they want authors to demonstrate real
        understanding of risky diffs, generated code, or LLM-assisted changes.
      </p>
    </div>

    <div class="cta-actions">
      <a class="button primary" href="https://github.com/apps/slopblock-quiz" target="_blank" rel="noreferrer">
        View GitHub App
      </a>
      <a class="button" href="https://github.com/sampnorris/slopblock-quiz" target="_blank" rel="noreferrer">
        Read Documentation
      </a>
    </div>
  </section>
</div>

<style>
  /* ── Mobile Top Bar ───────────────────────── */

  .mobile-topbar {
    display: none;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    height: 52px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
    position: sticky;
    top: 0;
    z-index: 30;
  }

  .mobile-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .mobile-logo {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--pink-400), var(--pink-700));
    color: #fff;
    flex: none;
  }

  .mobile-brand-name {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--gray-800);
  }

  .mobile-nav {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .mobile-nav-link {
    padding: 6px 12px;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 600;
    color: var(--gray-600);
    text-decoration: none;
    transition: all 150ms ease;
  }

  .mobile-nav-link:hover {
    background: var(--pink-50);
    color: var(--accent);
  }

  @media (max-width: 860px) {
    .mobile-topbar {
      display: flex;
    }
  }

  /* ── Landing Shell ────────────────────────── */

  .landing-shell {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
    padding: 36px 0 56px;
    display: grid;
    gap: 32px;
  }

  /* ── Hero ─────────────────────────────────── */

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.9fr);
    gap: 32px;
    padding: 40px;
    overflow: hidden;
    position: relative;
    background:
      radial-gradient(circle at top right, rgba(212, 80, 126, 0.14), transparent 34%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(253, 242, 246, 0.92));
  }

  .hero::after {
    content: "";
    position: absolute;
    inset: 14px;
    border: 1px solid rgba(212, 80, 126, 0.08);
    border-radius: calc(var(--radius-xl) - 6px);
    pointer-events: none;
  }

  .hero-copy,
  .hero-panel {
    position: relative;
    z-index: 1;
  }

  .hero-brand {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 22px;
  }

  .hero-logo {
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    border-radius: 16px;
    background: linear-gradient(135deg, var(--pink-400), var(--pink-700));
    color: #fff;
    box-shadow: 0 18px 32px rgba(212, 80, 126, 0.2);
    flex: none;
  }

  .hero-name {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--gray-800);
  }

  .hero-text {
    max-width: 62ch;
    font-size: 17px;
    line-height: 1.65;
  }

  .hero-meta {
    margin-top: 22px;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 28px;
  }

  .hero-button {
    width: auto;
    min-width: 160px;
  }

  .hero-panel {
    display: grid;
    gap: 14px;
    align-content: start;
  }

  /* ── Signal Card ──────────────────────────── */

  .signal-card {
    padding: 22px;
    border-radius: var(--radius-xl);
    background: rgba(255, 255, 255, 0.84);
    border: 1px solid rgba(212, 80, 126, 0.14);
    box-shadow: var(--shadow-card);
    backdrop-filter: blur(12px);
  }

  .signal-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }

  .signal-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--gray-600);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .signal-badge {
    display: inline-flex;
    align-items: center;
    border-radius: var(--radius-pill);
    padding: 6px 12px;
    background: var(--pink-100);
    color: var(--pink-700);
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .signal-list {
    display: grid;
    gap: 10px;
  }

  .signal-item {
    display: grid;
    grid-template-columns: 44px 1fr;
    gap: 12px;
    align-items: center;
    padding: 14px 16px;
    border-radius: var(--radius-lg);
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-sm);
  }

  .signal-index {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: linear-gradient(135deg, var(--pink-50), var(--pink-100));
    color: var(--pink-700);
    font: 700 13px/1 "DM Mono", ui-monospace, monospace;
    flex: none;
  }

  /* ── Section ──────────────────────────────── */

  .section-block {
    display: grid;
    gap: 20px;
  }

  .section-heading {
    display: grid;
    gap: 8px;
    max-width: 72ch;
  }

  /* ── Steps ────────────────────────────────── */

  .steps-grid {
    align-items: stretch;
  }

  .step-card {
    min-height: 160px;
    display: grid;
    gap: 14px;
    align-content: start;
  }

  .step-number {
    font: 700 14px/1 "DM Mono", ui-monospace, monospace;
    color: var(--pink-600);
  }

  /* ── Public Example Card ──────────────────── */

  .public-example-card {
    display: grid;
    gap: 24px;
    padding: 28px;
  }

  .example-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
  }

  .example-header-text {
    flex: 1;
    min-width: 0;
  }

  .example-title {
    margin-top: 10px;
    margin-bottom: 8px;
    font-size: 22px;
    line-height: 1.3;
  }

  .demo-link {
    width: auto;
    min-width: 140px;
    flex: none;
  }

  /* ── Diff Card ────────────────────────────── */

  .diff-card {
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    background: var(--gray-900);
    color: var(--gray-100);
    overflow: hidden;
  }

  .diff-label {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    font: 700 11px/1 "DM Mono", ui-monospace, monospace;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--pink-200);
  }

  .diff-block {
    margin: 0;
    padding: 16px;
    overflow-x: auto;
    font: 400 13px/1.7 "DM Mono", ui-monospace, monospace;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* ── Example Questions Grid ───────────────── */

  .examples-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
  }

  .example-card {
    display: grid;
    gap: 18px;
    align-content: start;
  }

  .example-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .question-chip,
  .example-tag {
    display: inline-flex;
    align-items: center;
    border-radius: var(--radius-pill);
    padding: 5px 11px;
    font-size: 12px;
    font-weight: 700;
  }

  .question-chip {
    background: var(--pink-100);
    color: var(--pink-700);
  }

  .example-tag {
    background: var(--gray-100);
    color: var(--gray-600);
  }

  h3 {
    margin: 0;
    font-size: 18px;
    line-height: 1.35;
    color: var(--gray-900);
    letter-spacing: -0.01em;
  }

  .option-list {
    display: grid;
    gap: 10px;
  }

  .option-row {
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: 12px;
    align-items: start;
    padding: 11px 14px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--line);
    background: var(--gray-50);
    color: var(--gray-700);
    font-size: 14px;
  }

  .correct-option {
    border-color: rgba(22, 163, 74, 0.22);
    background: var(--good-light);
  }

  .option-key {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid rgba(0, 0, 0, 0.06);
    color: var(--gray-700);
    font: 700 13px/1 "DM Mono", ui-monospace, monospace;
    flex: none;
  }

  .example-answer {
    margin-top: auto;
    font-size: 13px;
  }

  /* ── Demo CTA ─────────────────────────────── */

  .demo-cta-row {
    display: flex;
    justify-content: flex-start;
  }

  .demo-cta-row :global(.button) {
    width: auto;
    min-width: 220px;
  }

  /* ── Bottom CTA Card ──────────────────────── */

  .cta-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 28px;
    padding: 36px 40px;
  }

  .cta-copy {
    flex: 1;
    min-width: 0;
  }

  .cta-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    flex: none;
  }

  .cta-actions :global(.button) {
    width: auto;
    min-width: 180px;
  }

  /* ── Responsive: Tablet (≤ 980px) ────────── */

  @media (max-width: 980px) {
    .landing-shell {
      gap: 24px;
    }

    .hero {
      grid-template-columns: 1fr;
      gap: 28px;
    }

    .examples-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .cta-card {
      flex-direction: column;
      align-items: flex-start;
      padding: 28px;
    }

    .cta-actions {
      width: 100%;
    }

    .cta-actions :global(.button) {
      flex: 1;
      min-width: 140px;
    }
  }

  /* ── Responsive: Mobile (≤ 640px) ────────── */

  @media (max-width: 640px) {
    .landing-shell {
      width: calc(100% - 24px);
      padding-top: 20px;
      padding-bottom: 40px;
      gap: 20px;
    }

    .hero {
      padding: 24px 20px;
      gap: 24px;
    }

    .hero-brand {
      margin-bottom: 16px;
    }

    .hero-logo {
      width: 44px;
      height: 44px;
      border-radius: 13px;
    }

    .hero-name {
      font-size: 16px;
    }

    .hero-text {
      font-size: 15px;
    }

    .hero-meta {
      margin-top: 16px;
    }

    .hero-actions {
      flex-direction: column;
      gap: 10px;
      margin-top: 22px;
    }

    .hero-button {
      width: 100%;
      min-width: unset;
    }

    /* Signal panel on mobile */
    .signal-card {
      padding: 16px;
    }

    .signal-item {
      padding: 12px 14px;
    }

    /* Section blocks */
    .section-block {
      gap: 16px;
    }

    /* Steps become 1 column */
    .card-grid {
      grid-template-columns: 1fr;
    }

    .step-card {
      min-height: unset;
    }

    /* Example card */
    .public-example-card {
      padding: 20px 16px;
      gap: 20px;
    }

    .example-header {
      flex-direction: column;
      gap: 16px;
    }

    .demo-link {
      width: 100%;
      min-width: unset;
    }

    /* Examples always 1 col on mobile */
    .examples-grid {
      grid-template-columns: 1fr;
    }

    .demo-cta-row :global(.button) {
      width: 100%;
      min-width: unset;
    }

    /* CTA card */
    .cta-card {
      padding: 22px 20px;
    }

    .cta-actions :global(.button) {
      width: 100%;
    }
  }

  /* ── Responsive: Very small (≤ 380px) ────── */

  @media (max-width: 380px) {
    .landing-shell {
      width: calc(100% - 16px);
    }

    .hero {
      padding: 20px 16px;
    }

    .public-example-card {
      padding: 16px 12px;
    }
  }
</style>
