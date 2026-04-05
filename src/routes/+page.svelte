<script lang="ts">
  import SlopBlockLogo from "$lib/components/SlopBlockLogo.svelte";
</script>

<svelte:head>
  <title>SlopBlock</title>
</svelte:head>

<div class="page">
  <nav class="nav">
    <a href="/" class="nav-brand" aria-label="Home">
      <div class="nav-logo"><SlopBlockLogo width={18} height={18} /></div>
      <span>SlopBlock</span>
    </a>
    <div class="nav-links">
      <a href="/demo">Demo</a>
      <a href="/settings">Settings</a>
      <a
        href="https://github.com/apps/slopblock-quiz/installations/new"
        target="_blank"
        rel="noreferrer"
        class="nav-install"
      >Install</a>
    </div>
  </nav>

  <header class="hero">
    <div class="hero-logo"><SlopBlockLogo width={32} height={32} /></div>
    <h1>Block the merge until the author can explain the diff.</h1>
    <p class="lede">
      SlopBlock is a GitHub App. When a pull request opens, it reads the changed
      code and generates a short quiz. The author has to pass before the status
      check goes green.
    </p>
    <div class="hero-actions">
      <a
        class="btn btn-primary"
        href="https://github.com/apps/slopblock-quiz/installations/new"
        target="_blank"
        rel="noreferrer"
      >Install on GitHub</a>
      <a class="btn" href="/demo">Try the demo</a>
    </div>
  </header>

  <section class="how">
    <h2>How it works</h2>
    <ol class="steps">
      <li>
        <strong>PR opens.</strong> SlopBlock picks it up automatically when the
        pull request is opened or marked ready for review.
      </li>
      <li>
        <strong>Diff gets read.</strong> If the changes are trivial (typos,
        formatting, lockfiles), it skips the quiz entirely. Otherwise it builds
        questions from the actual code that changed.
      </li>
      <li>
        <strong>Author takes the quiz.</strong> A few multiple-choice questions
        about what the code does and why. No trick questions.
      </li>
      <li>
        <strong>Status check updates.</strong> Pass and the PR can merge. Fail
        and you get another attempt with fresh questions.
      </li>
    </ol>
  </section>

  <section class="why">
    <h2>Why bother</h2>
    <div class="reasons">
      <div class="reason">
        <h3>Catch vibe-coded PRs</h3>
        <p>
          If the author can't explain what their code does, that's useful
          information for the reviewer. SlopBlock surfaces it before anyone
          has to read the diff.
        </p>
      </div>
      <div class="reason">
        <h3>Lightweight by default</h3>
        <p>
          Small diffs get skipped. Config changes get skipped. The quiz only
          fires when the changes are complex enough to warrant it. You can tune
          the thresholds.
        </p>
      </div>
      <div class="reason">
        <h3>Works with your flow</h3>
        <p>
          It runs as a required status check. No new tabs, no separate
          dashboards. The author clicks a link in the PR, answers the
          questions, and they're done.
        </p>
      </div>
    </div>
  </section>

  <section class="demo-section">
    <div class="demo-inner">
      <div>
        <h2>See it in action</h2>
        <p>
          The public demo walks through a realistic quiz generated from a real
          diff. No account needed.
        </p>
      </div>
      <a class="btn btn-primary" href="/demo">Open the demo</a>
    </div>
  </section>

  <footer class="foot">
    <a
      href="https://github.com/sampnorris/slopblock"
      target="_blank"
      rel="noreferrer"
    >Source on GitHub</a>
  </footer>
</div>

<style>
  .page {
    max-width: 680px;
    margin: 0 auto;
    padding: 0 24px 80px;
  }

  /* Nav */

  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 0;
    margin-bottom: 24px;
  }

  .nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    font-size: 15px;
    color: var(--gray-800);
    text-decoration: none;
    letter-spacing: -0.02em;
  }

  .nav-brand:hover {
    color: var(--gray-900);
  }

  .nav-logo {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--pink-400), var(--pink-700));
    color: #fff;
    flex: none;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .nav-links a {
    padding: 7px 14px;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 600;
    color: var(--gray-500);
    text-decoration: none;
    transition: color 120ms ease, background 120ms ease;
  }

  .nav-links a:hover {
    color: var(--gray-800);
    background: var(--gray-100);
  }

  .nav-install {
    background: linear-gradient(135deg, var(--pink-400), var(--pink-600));
    color: #fff !important;
    border-radius: var(--radius-md);
  }

  .nav-install:hover {
    background: linear-gradient(135deg, var(--pink-500), var(--pink-700)) !important;
    color: #fff !important;
  }

  /* Hero */

  .hero {
    padding: 48px 0 0;
    margin-bottom: 64px;
  }

  .hero-logo {
    width: 56px;
    height: 56px;
    display: grid;
    place-items: center;
    border-radius: 15px;
    background: linear-gradient(135deg, var(--pink-400), var(--pink-700));
    color: #fff;
    margin-bottom: 32px;
    box-shadow: 0 12px 28px rgba(212, 80, 126, 0.2);
  }

  h1 {
    font-family: "Playfair Display", serif;
    font-size: clamp(28px, 5vw, 40px);
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.025em;
    color: var(--gray-900);
    margin: 0 0 20px;
    max-width: 18ch;
  }

  .lede {
    font-size: 17px;
    line-height: 1.65;
    color: var(--gray-500);
    margin: 0 0 32px;
    max-width: 52ch;
  }

  .hero-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  /* Buttons */

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 12px 22px;
    border-radius: var(--radius-md);
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--gray-700);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 120ms ease;
  }

  .btn:hover {
    border-color: var(--gray-300);
    background: var(--gray-50);
    color: var(--gray-900);
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--pink-400), var(--pink-600));
    color: #fff;
    border-color: transparent;
    box-shadow: 0 2px 8px rgba(212, 80, 126, 0.25);
  }

  .btn-primary:hover {
    background: linear-gradient(135deg, var(--pink-500), var(--pink-700));
    border-color: transparent;
    box-shadow: 0 4px 16px rgba(212, 80, 126, 0.35);
    color: #fff;
  }

  /* Sections */

  .how, .why, .demo-section {
    margin-bottom: 64px;
  }

  h2 {
    font-size: 20px;
    font-weight: 700;
    color: var(--gray-900);
    letter-spacing: -0.02em;
    margin: 0 0 24px;
    line-height: 1.3;
  }

  /* Steps */

  .steps {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0;
    counter-reset: step;
  }

  .steps li {
    counter-increment: step;
    padding: 20px 0;
    border-top: 1px solid var(--line);
    font-size: 15px;
    line-height: 1.6;
    color: var(--gray-600);
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: 16px;
    align-items: baseline;
  }

  .steps li:last-child {
    border-bottom: 1px solid var(--line);
  }

  .steps li::before {
    content: counter(step);
    font: 700 12px/1 "DM Sans", sans-serif;
    color: var(--pink-600);
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid var(--pink-200);
    background: var(--pink-50);
    flex: none;
  }

  .steps li strong {
    color: var(--gray-800);
    font-weight: 600;
  }

  /* Reasons */

  .reasons {
    display: grid;
    gap: 0;
  }

  .reason {
    padding: 24px 0;
    border-top: 1px solid var(--line);
  }

  .reason:last-child {
    border-bottom: 1px solid var(--line);
  }

  .reason h3 {
    font-size: 15px;
    font-weight: 700;
    color: var(--gray-800);
    margin: 0 0 8px;
    letter-spacing: -0.01em;
  }

  .reason p {
    font-size: 15px;
    line-height: 1.6;
    color: var(--gray-500);
    margin: 0;
    max-width: 55ch;
  }

  /* Demo CTA */

  .demo-inner {
    background:
      radial-gradient(ellipse at top right, rgba(212, 80, 126, 0.06), transparent 60%),
      var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    padding: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }

  .demo-inner h2 {
    margin-bottom: 8px;
  }

  .demo-inner p {
    font-size: 15px;
    line-height: 1.6;
    color: var(--gray-500);
    margin: 0;
    max-width: 38ch;
  }

  .demo-inner .btn {
    flex: none;
    white-space: nowrap;
  }

  /* Footer */

  .foot {
    padding-top: 40px;
    border-top: 1px solid var(--line);
  }

  .foot a {
    font-size: 13px;
    font-weight: 500;
    color: var(--gray-400);
    text-decoration: none;
  }

  .foot a:hover {
    color: var(--gray-600);
  }

  /* Responsive */

  @media (max-width: 600px) {
    .page {
      padding: 0 16px 60px;
    }

    .nav {
      padding: 16px 0;
      margin-bottom: 8px;
    }

    .hero {
      padding-top: 32px;
      margin-bottom: 48px;
    }

    .hero-logo {
      width: 48px;
      height: 48px;
      margin-bottom: 24px;
    }

    .lede {
      font-size: 16px;
    }

    .hero-actions {
      flex-direction: column;
    }

    .hero-actions .btn {
      width: 100%;
    }

    .how, .why, .demo-section {
      margin-bottom: 48px;
    }

    .steps li {
      grid-template-columns: 1fr;
      gap: 8px;
      padding: 16px 0;
    }

    .steps li::before {
      width: 28px;
      height: 28px;
      font-size: 11px;
    }

    .demo-inner {
      flex-direction: column;
      align-items: flex-start;
      padding: 24px;
    }

    .demo-inner .btn {
      width: 100%;
    }
  }
</style>
