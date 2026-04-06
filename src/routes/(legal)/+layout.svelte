<script>
  import SlopBlockLogo from "$lib/components/SlopBlockLogo.svelte";
  import { GITHUB_REPO_URL } from "$lib/constants";
</script>

<svelte:head>
  <meta name="robots" content="index, follow" />
</svelte:head>

<div class="legal-page">
  <nav class="legal-nav">
    <a href="/" class="legal-brand">
      <span class="legal-logo">
        <SlopBlockLogo width={18} height={18} />
      </span>
      <span class="legal-brand-text">SlopBlock</span>
    </a>
  </nav>

  <article class="prose">
    <slot />
  </article>

  <footer class="legal-footer">
    <a href="/privacy">Privacy Policy</a>
    <span class="legal-footer-sep"></span>
    <a href="/terms">Terms of Service</a>
    <span class="legal-footer-sep"></span>
    <a href="/contact">Contact</a>
    <span class="legal-footer-sep"></span>
    <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
  </footer>
</div>

<style>
  .legal-page {
    min-height: 100vh;
    background:
      radial-gradient(ellipse at top left, rgba(232, 112, 154, 0.04), transparent 50%),
      var(--bg);
  }

  /* ── Nav ──────────────────────────────────── */

  .legal-nav {
    padding: 20px 24px;
    border-bottom: 1px solid var(--line);
  }

  .legal-brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: #fff;
  }

  .legal-logo {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--pink-400), var(--pink-700));
    color: #fff;
    flex-shrink: 0;
  }

  .legal-brand-text {
    font: 600 15px/1 "DM Sans", sans-serif;
    letter-spacing: -0.01em;
  }

  /* ── Prose ────────────────────────────────── */

  .prose {
    width: min(720px, 100%);
    margin: 0 auto;
    padding: 48px 24px 80px;
    color: var(--text);
  }

  .prose :global(h1) {
    margin: 0 0 8px;
    font: 700 clamp(28px, 4vw, 36px)/1.15 "Playfair Display", serif;
    letter-spacing: -0.02em;
    color: #fff;
  }

  .prose :global(h2) {
    margin: 40px 0 12px;
    font: 600 20px/1.3 "DM Sans", sans-serif;
    letter-spacing: -0.01em;
    color: #fff;
  }

  .prose :global(h3) {
    margin: 28px 0 8px;
    font: 600 16px/1.4 "DM Sans", sans-serif;
    color: var(--gray-800);
  }

  .prose :global(p) {
    margin: 14px 0;
    font-size: 15px;
    line-height: 1.7;
    color: var(--muted);
  }

  .prose :global(strong) {
    color: var(--text);
    font-weight: 600;
  }

  .prose :global(a) {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-color: rgba(232, 112, 154, 0.3);
  }

  .prose :global(a:hover) {
    color: var(--accent-hover);
    text-decoration-color: var(--accent-hover);
  }

  .prose :global(ul),
  .prose :global(ol) {
    margin: 14px 0;
    padding-left: 24px;
    color: var(--muted);
    font-size: 15px;
    line-height: 1.7;
  }

  .prose :global(li) {
    margin: 6px 0;
  }

  .prose :global(li strong) {
    color: var(--text);
  }

  .prose :global(code) {
    font: 400 13px/1 "DM Mono", monospace;
    background: var(--gray-50);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--accent);
  }

  .prose :global(hr) {
    margin: 32px 0;
    border: none;
    border-top: 1px solid var(--line);
  }

  .prose :global(table) {
    width: 100%;
    margin: 16px 0;
    border-collapse: collapse;
    font-size: 14px;
  }

  .prose :global(th),
  .prose :global(td) {
    padding: 10px 14px;
    text-align: left;
    border-bottom: 1px solid var(--line);
    color: var(--muted);
  }

  .prose :global(th) {
    font-weight: 600;
    color: var(--text);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .prose :global(blockquote) {
    margin: 16px 0;
    padding: 12px 20px;
    border-left: 3px solid var(--accent);
    background: var(--gray-50);
    border-radius: 0 8px 8px 0;
    color: var(--muted);
  }

  /* ── Footer ──────────────────────────────── */

  .legal-footer {
    padding: 24px;
    border-top: 1px solid var(--line);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    font-size: 13px;
  }

  .legal-footer a {
    color: var(--muted);
    text-decoration: none;
  }

  .legal-footer a:hover {
    color: var(--accent);
  }

  .legal-footer-sep {
    width: 1px;
    height: 14px;
    background: var(--line);
  }
</style>
