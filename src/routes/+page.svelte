<script lang="ts">
  import SlopBlockLogo from "$lib/components/SlopBlockLogo.svelte";
  import { GITHUB_APP_INSTALL_URL, GITHUB_APP_URL, GITHUB_REPO_URL } from "$lib/constants";

  let activeTab: "solo" | "team" = $state("solo");
</script>

<svelte:head>
  <title>SlopBlock</title>
</svelte:head>

<div class="lp">
  <!-- ── HERO ──────────────────────────────────── -->
  <section class="hero">
    <div class="hero-grain"></div>

    <div class="hero-inner">
      <div class="hero-badge">
        <div class="hero-logo">
          <SlopBlockLogo width={22} height={22} />
        </div>
        <span class="hero-badge-text">SlopBlock</span>
        <span class="hero-badge-sep"></span>
        <span class="hero-badge-label">GitHub App</span>
      </div>

      <h1>
        <span class="h1-line">Know the code</span>
        <span class="h1-line h1-line-accent">before it ships.</span>
      </h1>

      <p class="hero-sub">
        SlopBlock posts a short quiz based on the actual diff.
        If the pull request matters, the author has to pass it before the merge goes through.
      </p>

      <div class="hero-cta">
        <a
          class="btn btn-primary"
          href={GITHUB_APP_INSTALL_URL}
          target="_blank"
          rel="noreferrer"
        >
          Install on GitHub
        </a>
        <a class="btn btn-ghost" href="/settings">
          Open Settings
        </a>
      </div>
    </div>
  </section>

  <!-- ── USE-CASE TABS ─────────────────────────── -->
  <section class="use-cases">
    <div class="uc-inner">
      <div class="uc-tabs" role="tablist">
        <button
          class="uc-tab"
          class:active={activeTab === "solo"}
          role="tab"
          aria-selected={activeTab === "solo"}
          onclick={() => (activeTab = "solo")}
        >
          <span class="uc-tab-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0113 0"/></svg>
          </span>
          For Solo Devs
        </button>
        <button
          class="uc-tab"
          class:active={activeTab === "team"}
          role="tab"
          aria-selected={activeTab === "team"}
          onclick={() => (activeTab = "team")}
        >
          <span class="uc-tab-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          </span>
          For Teams
        </button>
      </div>

      <!-- Solo panel -->
      <div class="uc-panel" class:visible={activeTab === "solo"}>
        <div class="uc-content">
          <p class="uc-kicker">Your second pair of eyes</p>
          <h2 class="uc-heading">Catch what speed<br />makes you miss.</h2>
          <p class="uc-body">
            Moving fast is fine. Blindly merging is the problem.
            When you're deep in a feature, especially with AI in the loop, it's easy to ship code you only half read.
            SlopBlock slows you down just long enough to prove you actually know what changed.
          </p>
          <div class="uc-points">
            <div class="uc-point">
              <span class="uc-point-num">01</span>
              <div>
                <strong>Review your own blind spots</strong>
                <p>The questions come from the diff, not from a generic list of best practices. They tend to hit the parts you'd otherwise skim.</p>
              </div>
            </div>
            <div class="uc-point">
              <span class="uc-point-num">02</span>
              <div>
                <strong>Understand AI-generated code</strong>
                <p>If Copilot or Cursor wrote half the PR, you should still be able to explain it. This gives you a quick gut check before it lands.</p>
              </div>
            </div>
            <div class="uc-point">
              <span class="uc-point-num">03</span>
              <div>
                <strong>Skip the obvious, quiz the risky</strong>
                <p>Docs, renames, and low-risk changes pass through automatically. The quiz shows up when a PR looks worth slowing down for.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="uc-visual">
          <div class="term">
            <div class="term-bar">
              <span class="term-dot"></span>
              <span class="term-dot"></span>
              <span class="term-dot"></span>
              <span class="term-title">solo workflow</span>
            </div>
            <div class="term-body">
              <span class="term-line"><span class="term-muted">$</span> git push origin feat/auth-refactor</span>
              <span class="term-line term-indent"><span class="term-ok">&#10003;</span> Lint passed</span>
              <span class="term-line term-indent"><span class="term-ok">&#10003;</span> Tests passed</span>
              <span class="term-line term-indent"><span class="term-wait">&#9679;</span> SlopBlock &mdash; <span class="term-highlight">3 questions about your changes</span></span>
              <span class="term-line">&nbsp;</span>
              <span class="term-line"><span class="term-muted">#</span> What does the new <span class="term-accent">refreshToken()</span> fallback do?</span>
              <span class="term-line"><span class="term-muted">#</span> <span class="term-dim">A) Returns null and logs out</span></span>
              <span class="term-line"><span class="term-muted">#</span> <span class="term-ok">B) Retries once, then returns the cached token</span> <span class="term-ok">&#10003;</span></span>
              <span class="term-line"><span class="term-muted">#</span> <span class="term-dim">C) Throws an AuthError</span></span>
              <span class="term-line">&nbsp;</span>
              <span class="term-line"><span class="term-ok">&#10003;</span> <span class="term-ok">Correct.</span> <span class="term-muted">The retry-then-cache strategy avoids forcing a re-login on transient failures.</span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Team panel -->
      <div class="uc-panel" class:visible={activeTab === "team"}>
        <div class="uc-content">
          <p class="uc-kicker">Enforce understanding at merge</p>
          <h2 class="uc-heading">No one merges what<br />they can't explain.</h2>
          <p class="uc-body">
            Code review can catch bugs. It does not always catch the author nodding along to code they barely understand.
            SlopBlock adds one more check before merge: can the person who opened this PR explain what changed and where it might break?
          </p>
          <div class="uc-points">
            <div class="uc-point">
              <span class="uc-point-num">01</span>
              <div>
                <strong>Stop rubber-stamped AI code</strong>
                <p>If AI wrote part of the pull request, the author still has to own it. Passing the quiz is a simple way to prove that.</p>
              </div>
            </div>
            <div class="uc-point">
              <span class="uc-point-num">02</span>
              <div>
                <strong>Configurable strictness</strong>
                <p>Routine changes can get a lighter touch. Auth, payments, and infra can get stricter checks. You control that per repo.</p>
              </div>
            </div>
            <div class="uc-point">
              <span class="uc-point-num">03</span>
              <div>
                <strong>Works alongside code review</strong>
                <p>SlopBlock runs as a status check. Reviewers still review. This just makes sure the author came prepared.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="uc-visual">
          <div class="term">
            <div class="term-bar">
              <span class="term-dot"></span>
              <span class="term-dot"></span>
              <span class="term-dot"></span>
              <span class="term-title">team workflow</span>
            </div>
            <div class="term-body">
              <span class="term-line"><span class="term-muted">PR #318</span> &nbsp; <span class="term-accent">feat: migrate payments to Stripe v4</span></span>
              <span class="term-line"><span class="term-muted">author:</span> @junior-dev &nbsp; <span class="term-muted">reviewers:</span> @lead, @security</span>
              <span class="term-line">&nbsp;</span>
              <span class="term-line term-indent"><span class="term-ok">&#10003;</span> CI / build</span>
              <span class="term-line term-indent"><span class="term-ok">&#10003;</span> CI / test</span>
              <span class="term-line term-indent"><span class="term-ok">&#10003;</span> @lead approved</span>
              <span class="term-line term-indent"><span class="term-wait">&#9679;</span> SlopBlock &mdash; <span class="term-highlight">Awaiting author quiz (3 questions)</span></span>
              <span class="term-line">&nbsp;</span>
              <span class="term-line"><span class="term-muted">#</span> Merge blocked until @junior-dev passes</span>
              <span class="term-line"><span class="term-muted">#</span> Questions focus on changed <span class="term-accent">webhook signature</span> and <span class="term-accent">idempotency key</span> logic</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── HOW IT WORKS ──────────────────────────── -->
  <section class="how">
    <div class="how-inner">
      <p class="how-kicker">How it works</p>
      <div class="how-steps">
        <article class="step">
          <div class="step-num">01</div>
          <h3>Reads the diff</h3>
          <p>Questions are tied to the changed lines in the PR, not generic trivia.</p>
        </article>
        <article class="step">
          <div class="step-num">02</div>
          <h3>Skips the obvious</h3>
          <p>Docs, renames, and trivial changes pass through without extra noise.</p>
        </article>
        <article class="step">
          <div class="step-num">03</div>
          <h3>Quizzes the author</h3>
          <p>The author gets a short multiple-choice quiz about behavior, risk, and implementation details in the PR.</p>
        </article>
        <article class="step">
          <div class="step-num">04</div>
          <h3>Unblocks the merge</h3>
          <p>Pass the quiz and the status check goes green. Miss a question and retry based on your team's policy.</p>
        </article>
      </div>
    </div>
  </section>

  <!-- ── CTA ───────────────────────────────────── -->
  <section class="cta">
    <div class="cta-inner">
      <p class="cta-kicker">For solo builders and teams</p>
      <h2 class="cta-heading">Stop merging code<br />nobody can explain.</h2>
      <div class="cta-buttons">
        <a
          class="btn btn-primary"
          href={GITHUB_APP_URL}
          target="_blank"
          rel="noreferrer"
        >
          View on GitHub
        </a>
        <a class="btn btn-ghost" href="/demo">
          Try Demo
        </a>
      </div>
    </div>
  </section>
</div>

<style>
  /* ── Page wrapper ─────────────────────────── */
  .lp {
    --lp-bg: #0c0c0e;
    --lp-surface: #161619;
    --lp-line: rgba(255, 255, 255, 0.07);
    --lp-text: #e4e4e7;
    --lp-muted: #71717a;
    --lp-pink: #e8709a;
    --lp-pink-glow: rgba(232, 112, 154, 0.15);

    background: var(--lp-bg);
    color: var(--lp-text);
    min-height: 100vh;
  }

  /* ── HERO ─────────────────────────────────── */
  .hero {
    position: relative;
    overflow: hidden;
    padding: clamp(60px, 12vh, 140px) 24px clamp(48px, 8vh, 100px);
    display: grid;
    place-items: center;
    background:
      radial-gradient(ellipse 70% 50% at 50% 0%, var(--lp-pink-glow), transparent),
      radial-gradient(ellipse 40% 60% at 80% 100%, rgba(232, 112, 154, 0.06), transparent),
      var(--lp-bg);
  }

  .hero-grain {
    position: absolute;
    inset: 0;
    opacity: 0.35;
    pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 180px;
  }

  .hero-inner {
    position: relative;
    width: min(820px, 100%);
    display: grid;
    gap: 0;
    text-align: center;
  }

  /* Badge */
  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin: 0 auto 36px;
    padding: 6px 16px 6px 6px;
    border-radius: 999px;
    border: 1px solid var(--lp-line);
    background: var(--lp-surface);
  }

  .hero-logo {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--pink-400), var(--pink-700));
    color: #fff;
    flex-shrink: 0;
  }

  .hero-badge-text {
    font: 600 14px/1 "DM Sans", sans-serif;
    color: #fff;
    letter-spacing: -0.01em;
  }

  .hero-badge-sep {
    width: 1px;
    height: 16px;
    background: var(--lp-line);
  }

  .hero-badge-label {
    font: 500 12px/1 "DM Mono", monospace;
    color: var(--lp-muted);
    letter-spacing: 0.04em;
  }

  /* Headline */
  h1 {
    margin: 0 0 24px;
    font: 700 clamp(36px, 7vw, 72px)/0.95 "Playfair Display", serif;
    letter-spacing: -0.035em;
    color: #fff;
  }

  .h1-line { display: block; }
  .h1-line-accent { color: var(--lp-pink); }

  .hero-sub {
    max-width: 56ch;
    margin: 0 auto 36px;
    font-size: clamp(16px, 1.8vw, 19px);
    line-height: 1.6;
    color: var(--lp-muted);
  }

  /* CTA buttons */
  .hero-cta, .cta-buttons {
    display: flex;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 14px 28px;
    border-radius: 12px;
    font: 600 15px/1 "DM Sans", sans-serif;
    letter-spacing: -0.01em;
    text-decoration: none;
    cursor: pointer;
    transition: all 160ms ease;
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--pink-400), var(--pink-600));
    color: #fff;
    border: none;
    box-shadow:
      0 0 0 1px rgba(232, 112, 154, 0.3),
      0 4px 24px rgba(232, 112, 154, 0.25);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow:
      0 0 0 1px rgba(232, 112, 154, 0.5),
      0 8px 40px rgba(232, 112, 154, 0.35);
    color: #fff;
  }

  .btn-ghost {
    background: transparent;
    color: var(--lp-text);
    border: 1px solid var(--lp-line);
  }

  .btn-ghost:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.14);
    color: #fff;
    transform: translateY(-2px);
  }

  /* ── USE-CASE SECTION ───────────────────────── */
  .use-cases {
    padding: clamp(48px, 8vh, 96px) 24px;
    border-top: 1px solid var(--lp-line);
  }

  .uc-inner {
    width: min(1120px, 100%);
    margin: 0 auto;
  }

  /* Tabs */
  .uc-tabs {
    display: flex;
    justify-content: center;
    gap: 4px;
    margin-bottom: 48px;
    padding: 4px;
    border-radius: 14px;
    background: var(--lp-surface);
    border: 1px solid var(--lp-line);
    width: fit-content;
    margin-left: auto;
    margin-right: auto;
  }

  .uc-tab {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 28px;
    border: none;
    border-radius: 10px;
    font: 600 14px/1 "DM Sans", sans-serif;
    color: var(--lp-muted);
    background: transparent;
    cursor: pointer;
    transition: all 200ms ease;
    letter-spacing: -0.01em;
  }

  .uc-tab:hover {
    color: var(--lp-text);
  }

  .uc-tab.active {
    background: rgba(232, 112, 154, 0.12);
    color: var(--lp-pink);
    box-shadow: 0 0 20px rgba(232, 112, 154, 0.08);
  }

  .uc-tab-icon {
    display: grid;
    place-items: center;
    opacity: 0.5;
  }

  .uc-tab.active .uc-tab-icon { opacity: 1; }

  /* Panel */
  .uc-panel {
    display: none;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    align-items: start;
  }

  .uc-panel.visible {
    display: grid;
    animation: fadeUp 400ms ease both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Content side */
  .uc-kicker {
    font: 500 12px/1 "DM Mono", monospace;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--lp-pink);
    margin: 0 0 16px;
  }

  .uc-heading {
    margin: 0 0 20px;
    font: 700 clamp(26px, 4vw, 40px)/1.05 "Playfair Display", serif;
    color: #fff;
    letter-spacing: -0.03em;
  }

  .uc-body {
    margin: 0 0 32px;
    font-size: 15px;
    line-height: 1.7;
    color: var(--lp-muted);
  }

  .uc-points {
    display: grid;
    gap: 20px;
  }

  .uc-point {
    display: flex;
    gap: 16px;
    align-items: start;
  }

  .uc-point-num {
    font: 700 12px/1 "DM Mono", monospace;
    color: var(--lp-pink);
    padding-top: 3px;
    flex: none;
    letter-spacing: 0.06em;
  }

  .uc-point strong {
    display: block;
    font: 600 15px/1.3 "DM Sans", sans-serif;
    color: #fff;
    margin-bottom: 4px;
    letter-spacing: -0.01em;
  }

  .uc-point p {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--lp-muted);
  }

  /* Visual side */
  .uc-visual {
    position: sticky;
    top: 32px;
  }

  /* Terminal mock */
  .term {
    border-radius: 14px;
    border: 1px solid var(--lp-line);
    background: var(--lp-surface);
    overflow: hidden;
    text-align: left;
    box-shadow:
      0 2px 0 rgba(255, 255, 255, 0.02),
      0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .term-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--lp-line);
  }

  .term-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
  }

  .term-title {
    margin-left: auto;
    font: 500 11px/1 "DM Mono", monospace;
    color: var(--lp-muted);
    letter-spacing: 0.02em;
  }

  .term-body {
    padding: 20px 22px;
    display: grid;
    gap: 6px;
    font: 400 13px/1.65 "DM Mono", monospace;
    color: var(--lp-text);
  }

  .term-line { display: block; white-space: pre-wrap; }
  .term-indent { padding-left: 24px; }
  .term-muted { color: var(--lp-muted); }
  .term-ok { color: #4ade80; }
  .term-dim { color: var(--lp-muted); opacity: 0.6; }
  .term-accent { color: var(--lp-pink); }

  .term-wait {
    color: var(--lp-pink);
    animation: pulse-dot 2s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .term-highlight {
    color: var(--lp-pink);
    font-weight: 500;
  }

  /* ── HOW IT WORKS ───────────────────────────── */
  .how {
    padding: clamp(48px, 8vh, 96px) 24px;
    border-top: 1px solid var(--lp-line);
  }

  .how-inner {
    width: min(1120px, 100%);
    margin: 0 auto;
  }

  .how-kicker {
    font: 500 12px/1 "DM Mono", monospace;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--lp-pink);
    margin: 0 0 36px;
    text-align: center;
  }

  .how-steps {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2px;
  }

  .step {
    padding: 32px 28px;
    border-radius: 16px;
    background: var(--lp-surface);
    border: 1px solid var(--lp-line);
    display: grid;
    gap: 12px;
    align-content: start;
    transition: border-color 300ms ease, box-shadow 300ms ease;
  }

  .step:hover {
    border-color: rgba(232, 112, 154, 0.2);
    box-shadow: 0 0 40px rgba(232, 112, 154, 0.06);
  }

  .step-num {
    font: 700 13px/1 "DM Mono", monospace;
    color: var(--lp-pink);
    letter-spacing: 0.06em;
  }

  .step h3 {
    margin: 0;
    font: 600 18px/1.2 "DM Sans", sans-serif;
    color: #fff;
    letter-spacing: -0.02em;
  }

  .step p {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.65;
    color: var(--lp-muted);
  }

  /* ── CTA ──────────────────────────────────── */
  .cta {
    padding: clamp(56px, 10vh, 120px) 24px;
    border-top: 1px solid var(--lp-line);
    display: grid;
    place-items: center;
    text-align: center;
    background:
      radial-gradient(ellipse 60% 50% at 50% 100%, var(--lp-pink-glow), transparent),
      var(--lp-bg);
  }

  .cta-inner {
    display: grid;
    gap: 28px;
    justify-items: center;
  }

  .cta-kicker {
    font: 500 12px/1 "DM Mono", monospace;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--lp-pink);
    margin: 0;
  }

  .cta-heading {
    margin: 0;
    font: 700 clamp(28px, 5vw, 48px)/1.05 "Playfair Display", serif;
    color: #fff;
    letter-spacing: -0.03em;
  }

  /* ── Responsive ──────────────────────────── */
  @media (max-width: 900px) {
    .uc-panel.visible {
      grid-template-columns: 1fr;
      gap: 32px;
    }

    .uc-visual {
      position: static;
    }

    .how-steps {
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
  }

  @media (max-width: 600px) {
    .hero-cta, .cta-buttons {
      flex-direction: column;
      align-items: stretch;
    }

    .btn { width: 100%; }

    .how-steps {
      grid-template-columns: 1fr;
    }

    .uc-tabs {
      width: 100%;
    }

    .uc-tab {
      flex: 1;
      justify-content: center;
      padding: 12px 16px;
    }
  }
</style>
