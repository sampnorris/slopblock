<script lang="ts">
  import SlopBlockLogo from "$lib/components/SlopBlockLogo.svelte";

  const exampleQuestions = [
    {
      prompt: "Which change makes the new retry flow idempotent?",
      options: [
        "The handler now checks the existing session state before creating another retry record.",
        "The retry button was renamed to be more explicit.",
        "The CSS transition duration was reduced from 200ms to 150ms.",
      ],
      answer: "Correct answer: the state guard prevents duplicate retries from creating extra side effects.",
    },
    {
      prompt: "What does the diff show about how failed validation is surfaced to the user?",
      options: [
        "A structured error message is returned and rendered inline in the form.",
        "The app silently retries the request three times.",
        "Validation failures are only logged on the server.",
      ],
      answer: "Correct answer: the response now carries a user-facing message instead of hiding the failure in logs.",
    },
    {
      prompt: "Why would SlopBlock ask about a new helper instead of the entire file?",
      options: [
        "Because the question should stay grounded in the changed lines, not generic repo trivia.",
        "Because larger files cannot be parsed by the app.",
        "Because every PR is limited to one file.",
      ],
      answer: "Correct answer: the quiz is intentionally diff-grounded so authors must understand the exact change they made.",
    },
  ];

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

<div class="landing-shell">
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
        <a class="button primary hero-button" href="https://github.com/apps/slop-block/installations/new" target="_blank" rel="noreferrer">
          Install SlopBlock
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

  <section class="section-block">
    <div class="section-heading">
      <div class="eyebrow">Example questions</div>
      <h2>The quiz stays anchored to the diff</h2>
      <p>
        These are the kinds of questions SlopBlock asks. They are specific, checkable, and about
        the actual code change rather than general repository knowledge.
      </p>
    </div>

    <div class="examples-grid">
      {#each exampleQuestions as question, index}
        <article class="card example-card">
          <div class="example-topline">
            <span class="question-chip">Question {index + 1}</span>
            <span class="example-tag">Multiple choice</span>
          </div>

          <h3>{question.prompt}</h3>

          <div class="option-list">
            {#each question.options as option, optionIndex}
              <div class:correct-option={optionIndex === 0} class="option-row">
                <span class="option-key">{String.fromCharCode(65 + optionIndex)}</span>
                <span>{option}</span>
              </div>
            {/each}
          </div>

          <div class="notice good example-answer">{question.answer}</div>
        </article>
      {/each}
    </div>
  </section>

  <section class="card cta-card">
    <div>
      <div class="eyebrow">Why teams use it</div>
      <h2>Catch cargo-culted changes before they merge</h2>
      <p>
        SlopBlock gives maintainers a lightweight gate when they want authors to demonstrate real
        understanding of risky diffs, generated code, or LLM-assisted changes.
      </p>
    </div>

    <div class="cta-actions">
      <a class="button primary" href="https://github.com/apps/slop-block" target="_blank" rel="noreferrer">
        View GitHub App
      </a>
      <a class="button" href="https://github.com/sampnorris/slopblock" target="_blank" rel="noreferrer">
        Read Documentation
      </a>
    </div>
  </section>
</div>

<style>
  .landing-shell {
    width: min(1180px, calc(100% - 32px));
    margin: 0 auto;
    padding: 32px 0 48px;
    display: grid;
    gap: 28px;
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.9fr);
    gap: 28px;
    padding: 32px;
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
    margin-bottom: 20px;
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
    min-width: 170px;
  }

  .hero-panel {
    display: grid;
    gap: 14px;
    align-content: start;
  }

  .signal-card {
    padding: 20px;
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
  }

  .signal-list {
    display: grid;
    gap: 12px;
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
  }

  .section-block {
    display: grid;
    gap: 18px;
  }

  .section-heading {
    display: grid;
    gap: 8px;
    max-width: 72ch;
  }

  .steps-grid {
    align-items: stretch;
  }

  .step-card {
    min-height: 180px;
    display: grid;
    gap: 14px;
    align-content: start;
  }

  .step-number {
    font: 700 14px/1 "DM Mono", ui-monospace, monospace;
    color: var(--pink-600);
  }

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
  }

  .question-chip,
  .example-tag {
    display: inline-flex;
    align-items: center;
    border-radius: var(--radius-pill);
    padding: 6px 11px;
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
    font-size: 20px;
    line-height: 1.35;
    color: var(--gray-900);
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
    padding: 12px 14px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--line);
    background: var(--gray-50);
    color: var(--gray-700);
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
  }

  .example-answer {
    margin-top: auto;
  }

  .cta-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }

  .cta-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .cta-actions :global(.button) {
    width: auto;
    min-width: 180px;
  }

  @media (max-width: 980px) {
    .hero,
    .examples-grid,
    .cta-card {
      grid-template-columns: 1fr;
      display: grid;
    }

    .cta-actions {
      width: 100%;
    }

    .cta-actions :global(.button) {
      width: 100%;
    }
  }

  @media (max-width: 720px) {
    .landing-shell {
      width: min(100% - 24px, 1180px);
      padding-top: 16px;
    }

    .hero {
      padding: 22px;
    }

    .hero-actions,
    .hero-button {
      width: 100%;
    }

    .signal-row,
    .example-topline {
      align-items: start;
      flex-direction: column;
    }
  }
</style>
