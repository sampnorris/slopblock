<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const installationId = $derived(data.installationId);
  const sessions = $derived(data.sessions);
  const stats = $derived(data.sessionStats);
  const attempts = $derived(data.attemptStats);

  const passRate = $derived(attempts.totalAttempts > 0
    ? Math.round((attempts.passedAttempts / attempts.totalAttempts) * 100)
    : 0);

  function statusLabel(status: string): string {
    switch (status) {
      case "awaiting_answer": return "Awaiting";
      case "passed": return "Passed";
      case "failed": return "Failed";
      case "skipped": return "Skipped";
      case "quota_exceeded": return "Quota";
      default: return status;
    }
  }

  function statusClass(status: string): string {
    switch (status) {
      case "passed": return "status-passed";
      case "failed": return "status-failed";
      case "skipped": return "status-skipped";
      case "awaiting_answer": return "status-awaiting";
      case "quota_exceeded": return "status-skipped";
      default: return "";
    }
  }

  function isBudgetExceeded(session: any): boolean {
    return session.failureMessage?.includes("Token budget exceeded") ?? false;
  }

  function timeAgo(date: string | Date): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString();
  }

  // Pass rate bar width
  const passBarWidth = $derived(Math.max(passRate, 2)); // min 2% so bar is always visible
</script>

<svelte:head>
  <title>SlopBlock - activity</title>
</svelte:head>

<div class="main-area">
  <header class="topbar">
    <a href="/settings/{installationId}" class="topbar-back" aria-label="Back to configuration">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
    </a>
    <span class="topbar-title">Activity</span>
    <div class="topbar-spacer"></div>
  </header>

  <div class="content">
    <div class="page-header">
      <p class="eyebrow">Dashboard</p>
      <h1>Quiz Activity</h1>
      <p class="page-desc">Recent quiz sessions and pass/fail statistics for this installation.</p>
    </div>

    <!-- Stats -->
    <div class="stats-card">
      <div class="stats-top">
        <div class="pass-rate">
          <div class="pass-rate-header">
            <span class="pass-rate-num">{passRate}<span class="pass-rate-pct">%</span></span>
            <span class="pass-rate-label">Pass Rate</span>
          </div>
          <div class="pass-rate-bar">
            <div
              class="pass-rate-fill"
              class:fill-good={passRate >= 50}
              class:fill-bad={passRate > 0 && passRate < 50}
              style="width: {passBarWidth}%"
            ></div>
          </div>
          <div class="pass-rate-detail">
            <span>{attempts.passedAttempts} passed</span>
            <span class="pass-rate-sep">/</span>
            <span>{attempts.totalAttempts} attempts</span>
            <span class="pass-rate-sep">&middot;</span>
            <span>{attempts.uniqueAuthors} {attempts.uniqueAuthors === 1 ? "author" : "authors"}</span>
          </div>
        </div>
      </div>

      <div class="stats-divider"></div>

      <div class="stats-bottom">
        <div class="stat-cell">
          <span class="stat-val">{stats.total}</span>
          <span class="stat-key">Quizzes</span>
        </div>
        <div class="stat-cell">
          <span class="stat-val stat-val-good">{stats.passed}</span>
          <span class="stat-key">Passed</span>
        </div>
        <div class="stat-cell">
          <span class="stat-val stat-val-bad">{stats.failed}</span>
          <span class="stat-key">Failed</span>
        </div>
        <div class="stat-cell">
          <span class="stat-val">{stats.awaiting}</span>
          <span class="stat-key">Awaiting</span>
        </div>
        {#if stats.skipped > 0}
          <div class="stat-cell">
            <span class="stat-val">{stats.skipped}</span>
            <span class="stat-key">Skipped</span>
          </div>
        {/if}
        {#if stats.budgetExceeded > 0}
          <div class="stat-cell stat-cell-warn">
            <span class="stat-val stat-val-warn">{stats.budgetExceeded}</span>
            <span class="stat-key">Budget Hit</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Session list -->
    <div class="section-header">
      <h2>Recent Sessions</h2>
      <p class="section-desc">Showing the {sessions.length} most recent quiz sessions.</p>
    </div>

    {#if sessions.length === 0}
      <div class="empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <h2>No quiz sessions yet</h2>
        <p>Quiz sessions will appear here once pull requests trigger quiz generation.</p>
      </div>
    {:else}
      <div class="session-list">
        {#each sessions as session, i (session.id)}
          <div class="session-row" style="animation-delay: {i * 40}ms">
            <div class="session-status-col">
              <span class="status-badge {statusClass(session.status)}">{statusLabel(session.status)}</span>
              {#if isBudgetExceeded(session)}
                <span class="budget-tag">Budget</span>
              {/if}
            </div>
            <div class="session-info">
              <div class="session-pr">
                <a
                  href="https://github.com/{session.repositoryOwner}/{session.repositoryName}/pull/{session.pullNumber}"
                  target="_blank"
                  class="pr-link"
                >
                  <span class="pr-repo">{session.repositoryOwner}/{session.repositoryName}</span><span class="pr-num">#{session.pullNumber}</span>
                </a>
                {#if session.questionCount > 0}
                  <span class="question-count">{session.questionCount}q</span>
                {/if}
              </div>
              {#if session.summary}
                <p class="session-summary">{session.summary}</p>
              {:else if session.skipReason}
                <p class="session-summary skip-reason">{session.skipReason}</p>
              {:else if session.failureMessage}
                <p class="session-summary fail-reason">{session.failureMessage}</p>
              {/if}
              <div class="session-meta">
                <span class="meta-author">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  {session.authorLogin}
                </span>
                <span class="meta-sha" title={session.headSha}>{session.headSha.slice(0, 7)}</span>
                <span class="meta-time">{timeAgo(session.updatedAt)}</span>
                {#if session.id}
                  <a href="/session/{session.id}" class="meta-quiz-link">View quiz</a>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  /* ── Page Header ── */
  .page-header {
    margin-bottom: 28px;
  }
  .page-desc {
    margin-top: 6px;
    font-size: 14px;
  }

  /* ── Stats Card ── */
  .stats-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    padding: 24px;
    margin-bottom: 32px;
    animation: fade-up 400ms ease both;
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Pass rate top section */
  .stats-top {
    margin-bottom: 20px;
  }
  .pass-rate-header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 10px;
  }
  .pass-rate-num {
    font: 700 32px/1 "Playfair Display", serif;
    color: #fff;
    letter-spacing: -0.02em;
  }
  .pass-rate-pct {
    font: 500 14px/1 "DM Mono", monospace;
    color: var(--muted);
  }
  .pass-rate-label {
    font: 500 11px/1 "DM Mono", monospace;
    color: var(--muted);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* Bar */
  .pass-rate-bar {
    height: 6px;
    background: var(--gray-200);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  .pass-rate-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--gray-400);
    transition: width 600ms cubic-bezier(0.35, 0, 0.15, 1);
  }
  .pass-rate-fill.fill-good { background: var(--good); }
  .pass-rate-fill.fill-bad { background: var(--bad); }

  /* Detail line */
  .pass-rate-detail {
    font: 400 12px/1 "DM Sans", sans-serif;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .pass-rate-sep {
    color: var(--gray-300);
  }

  /* Divider */
  .stats-divider {
    height: 1px;
    background: var(--line);
    margin-bottom: 18px;
  }

  /* Bottom stats row */
  .stats-bottom {
    display: flex;
    gap: 0;
  }
  .stat-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
    padding: 0 12px;
    border-right: 1px solid var(--line);
  }
  .stat-cell:first-child { padding-left: 0; }
  .stat-cell:last-child { border-right: none; padding-right: 0; }

  .stat-val {
    font: 700 20px/1 "Playfair Display", serif;
    color: #fff;
  }
  .stat-val-good { color: var(--good); }
  .stat-val-bad { color: var(--bad); }
  .stat-val-warn { color: rgb(234, 179, 8); }
  .stat-key {
    font: 500 10px/1 "DM Mono", monospace;
    color: var(--muted);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .stat-cell-warn {
    border-right-color: rgba(234, 179, 8, 0.15);
  }

  /* ── Section Header ── */
  .section-header {
    margin: 0 0 16px;
  }
  .section-header h2 { margin-bottom: 4px; }
  .section-desc { font-size: 13px; color: var(--muted); }

  /* ── Empty State ── */
  .empty-state {
    text-align: center;
    padding: 48px 20px;
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    background: var(--surface);
    color: var(--muted);
  }
  .empty-state svg { margin-bottom: 12px; color: var(--gray-400); }
  .empty-state h2 { color: #fff; margin-bottom: 6px; }

  /* ── Session List ── */
  .session-list {
    display: grid;
    gap: 6px;
  }

  .session-row {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding: 14px 18px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    transition: border-color 150ms ease;
    animation: row-in 350ms ease both;
    overflow: hidden;
  }
  @keyframes row-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .session-row:hover { border-color: rgba(232, 112, 154, 0.15); }

  .session-status-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
    min-width: 72px;
    flex: none;
    padding-top: 2px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: var(--radius-pill);
    font: 600 10px/1 "DM Mono", monospace;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border: 1px solid var(--line);
    background: var(--gray-50);
    color: var(--muted);
    white-space: nowrap;
  }
  .status-passed {
    background: var(--good-light);
    color: var(--good);
    border-color: rgba(74, 222, 128, 0.2);
  }
  .status-failed {
    background: var(--bad-light);
    color: var(--bad);
    border-color: rgba(239, 68, 68, 0.2);
  }
  .status-awaiting {
    background: rgba(232, 112, 154, 0.08);
    color: var(--accent);
    border-color: rgba(232, 112, 154, 0.2);
  }
  .status-skipped {
    background: var(--gray-50);
    color: var(--muted);
    border-color: var(--line);
  }

  .budget-tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 7px;
    border-radius: var(--radius-pill);
    font: 600 9px/1 "DM Mono", monospace;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    background: rgba(234, 179, 8, 0.1);
    color: rgb(200, 155, 10);
    border: 1px solid rgba(234, 179, 8, 0.2);
    white-space: nowrap;
  }

  .session-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .session-pr {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .pr-link {
    font: 600 14px/1.3 "DM Sans", sans-serif;
    color: #fff;
    text-decoration: none;
    transition: color 150ms ease;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .pr-link:hover { color: var(--accent); }
  .pr-repo {
    color: var(--gray-600);
    font-weight: 500;
  }
  .pr-link:hover .pr-repo { color: var(--accent); }
  .pr-num {
    color: var(--accent);
    font-weight: 600;
  }

  .question-count {
    font: 500 11px/1 "DM Mono", monospace;
    color: var(--muted);
    background: var(--gray-50);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    flex: none;
  }

  .session-summary {
    font-size: 13px;
    color: var(--muted);
    line-height: 1.5;
    margin-top: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .skip-reason { color: var(--gray-500); font-style: italic; }
  .fail-reason { color: rgba(239, 68, 68, 0.7); }

  .session-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 6px;
    font-size: 12px;
    color: var(--muted);
    overflow: hidden;
  }
  .meta-author {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
    color: var(--gray-600);
    white-space: nowrap;
  }
  .meta-author svg { flex: none; opacity: 0.6; }
  .meta-sha {
    font: 400 11px/1 "DM Mono", monospace;
    color: var(--gray-500);
    flex: none;
  }
  .meta-time {
    color: var(--gray-500);
    white-space: nowrap;
  }
  .meta-quiz-link {
    font-weight: 600;
    color: var(--accent);
    font-size: 12px;
    margin-left: auto;
    white-space: nowrap;
    flex: none;
  }
  .meta-quiz-link:hover { color: var(--accent-hover); }

  /* ── Topbar back ── */
  .topbar-back {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    color: var(--muted);
    transition: all 150ms ease;
  }
  .topbar-back:hover {
    background: rgba(255, 255, 255, 0.04);
    color: var(--text);
  }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .stats-card { padding: 18px; }
    .stats-bottom {
      flex-wrap: wrap;
      gap: 14px;
    }
    .stat-cell {
      border-right: none;
      padding: 0;
      min-width: calc(33% - 10px);
    }
    .session-row {
      flex-direction: column;
      gap: 8px;
    }
    .session-status-col {
      flex-direction: row;
      min-width: 0;
    }
    .session-meta {
      flex-wrap: wrap;
      gap: 8px;
    }
  }
</style>
