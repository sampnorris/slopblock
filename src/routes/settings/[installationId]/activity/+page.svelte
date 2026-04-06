<script lang="ts">
  import SlopBlockLogo from "$lib/components/SlopBlockLogo.svelte";
  import { GITHUB_APP_URL, BUY_ME_A_COFFEE_URL, BUY_ME_A_COFFEE_IMG } from "$lib/constants";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const installationId = data.installationId;
  const actor = data.actor;
  const sessions = data.sessions;
  const stats = data.sessionStats;
  const attempts = data.attemptStats;

  const passRate = attempts.totalAttempts > 0
    ? Math.round((attempts.passedAttempts / attempts.totalAttempts) * 100)
    : 0;

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
</script>

<svelte:head>
  <title>SlopBlock - activity</title>
</svelte:head>

<div class="app-layout">
  <aside class="sidebar">
    <div class="sidebar-brand">
      <div class="sidebar-logo"><SlopBlockLogo /></div>
      <span class="sidebar-title">SlopBlock</span>
    </div>
    <nav class="sidebar-nav">
      <a href="/settings" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        Installations
      </a>
      <a href="/settings/{installationId}" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        Configuration
      </a>
      <a href="/settings/{installationId}/activity" class="sidebar-link active">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Activity
      </a>
      <a href={GITHUB_APP_URL} target="_blank" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
        GitHub App
        <svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
    </nav>
    <div class="sidebar-footer">
      <a href={BUY_ME_A_COFFEE_URL} target="_blank" class="bmc-link">
        <img src={BUY_ME_A_COFFEE_IMG} alt="Buy Me A Coffee" />
      </a>
      <div class="sidebar-user">
        <div class="sidebar-user-avatar">{actor.login[0].toUpperCase()}</div>
        <div class="sidebar-user-info">
          <span class="sidebar-user-name">{actor.login}</span>
          <span class="sidebar-user-role">Authenticated</span>
        </div>
      </div>
    </div>
  </aside>

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
        <h1>Quiz Activity</h1>
        <p>Recent quiz sessions and pass/fail statistics for this installation.</p>
      </div>

      <!-- Stats row -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-num">{stats.total}</span>
          <span class="stat-label">Total Quizzes</span>
        </div>
        <div class="stat-card">
          <span class="stat-num stat-good">{stats.passed}</span>
          <span class="stat-label">Passed</span>
        </div>
        <div class="stat-card">
          <span class="stat-num stat-bad">{stats.failed}</span>
          <span class="stat-label">Failed</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{stats.awaiting}</span>
          <span class="stat-label">Awaiting</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{stats.skipped}</span>
          <span class="stat-label">Skipped</span>
        </div>
      </div>

      <!-- Attempt stats -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-num">{attempts.totalAttempts}</span>
          <span class="stat-label">Quiz Attempts</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{passRate}<span class="stat-unit">%</span></span>
          <span class="stat-label">Pass Rate</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{attempts.uniqueAuthors}</span>
          <span class="stat-label">Authors</span>
        </div>
        {#if stats.budgetExceeded > 0}
          <div class="stat-card stat-card-warn">
            <span class="stat-num stat-warn">{stats.budgetExceeded}</span>
            <span class="stat-label">Budget Exceeded</span>
          </div>
        {/if}
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
          {#each sessions as session}
            <div class="session-row">
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
                    {session.repositoryOwner}/{session.repositoryName}#{session.pullNumber}
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
</div>

<style>
  .page-header { margin-bottom: 20px; }
  .page-header p { margin-top: 4px; font-size: 14px; }

  /* Stats */
  .stats-row {
    display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;
  }
  .stat-card {
    display: flex; flex-direction: column; gap: 4px;
    padding: 14px 18px; background: var(--surface);
    border: 1px solid var(--line); border-radius: var(--radius-lg);
    min-width: 100px; flex: 1;
  }
  .stat-card-warn {
    border-color: rgba(234, 179, 8, 0.2);
    background: rgba(234, 179, 8, 0.04);
  }
  .stat-num {
    font: 700 22px/1 "Playfair Display", serif; color: #fff;
  }
  .stat-unit { font-size: 14px; font-weight: 500; color: var(--muted); }
  .stat-good { color: var(--good); }
  .stat-bad { color: var(--bad); }
  .stat-warn { color: rgb(234, 179, 8); }
  .stat-label {
    font: 500 11px/1 "DM Mono", monospace; color: var(--muted);
    letter-spacing: 0.04em; text-transform: uppercase;
  }

  /* Section header */
  .section-header { margin: 24px 0 14px; }
  .section-header h2 { margin-bottom: 4px; }
  .section-desc { font-size: 13px; color: var(--muted); }

  /* Empty state */
  .empty-state {
    text-align: center; padding: 48px 20px;
    border: 1px solid var(--line); border-radius: var(--radius-xl);
    background: var(--surface); color: var(--muted);
  }
  .empty-state svg { margin-bottom: 12px; color: var(--gray-400); }
  .empty-state h2 { color: #fff; margin-bottom: 6px; }

  /* Session list */
  .session-list { display: grid; gap: 6px; }

  .session-row {
    display: flex; gap: 14px; align-items: flex-start;
    padding: 14px 18px;
    background: var(--surface);
    border: 1px solid var(--line); border-radius: var(--radius-lg);
    transition: border-color 150ms ease;
  }
  .session-row:hover { border-color: rgba(232, 112, 154, 0.15); }

  .session-status-col {
    display: flex; flex-direction: column; gap: 4px;
    align-items: center; min-width: 72px; padding-top: 2px;
  }

  .status-badge {
    display: inline-flex; align-items: center;
    padding: 3px 9px; border-radius: var(--radius-pill);
    font: 600 10px/1 "DM Mono", monospace;
    letter-spacing: 0.04em; text-transform: uppercase;
    border: 1px solid var(--line);
    background: var(--gray-50); color: var(--muted);
  }
  .status-passed {
    background: var(--good-light); color: var(--good);
    border-color: rgba(74, 222, 128, 0.2);
  }
  .status-failed {
    background: var(--bad-light); color: var(--bad);
    border-color: rgba(239, 68, 68, 0.2);
  }
  .status-awaiting {
    background: rgba(232, 112, 154, 0.08); color: var(--accent);
    border-color: rgba(232, 112, 154, 0.2);
  }
  .status-skipped {
    background: var(--gray-50); color: var(--muted);
    border-color: var(--line);
  }

  .budget-tag {
    display: inline-flex; align-items: center;
    padding: 2px 7px; border-radius: var(--radius-pill);
    font: 600 9px/1 "DM Mono", monospace;
    letter-spacing: 0.04em; text-transform: uppercase;
    background: rgba(234, 179, 8, 0.1); color: rgb(200, 155, 10);
    border: 1px solid rgba(234, 179, 8, 0.2);
  }

  .session-info { flex: 1; min-width: 0; }

  .session-pr {
    display: flex; align-items: center; gap: 8px;
  }
  .pr-link {
    font: 600 14px/1.3 "DM Sans", sans-serif; color: #fff;
    text-decoration: none; transition: color 150ms ease;
  }
  .pr-link:hover { color: var(--accent); }

  .question-count {
    font: 500 11px/1 "DM Mono", monospace;
    color: var(--muted); background: var(--gray-50);
    padding: 2px 6px; border-radius: var(--radius-sm);
    border: 1px solid var(--line);
  }

  .session-summary {
    font-size: 13px; color: var(--muted); line-height: 1.5;
    margin-top: 4px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .skip-reason { color: var(--gray-500); font-style: italic; }
  .fail-reason { color: rgba(239, 68, 68, 0.7); }

  .session-meta {
    display: flex; align-items: center; gap: 12px;
    margin-top: 6px; font-size: 12px; color: var(--muted);
  }
  .meta-author {
    display: flex; align-items: center; gap: 4px;
    font-weight: 500; color: var(--gray-600);
  }
  .meta-author svg { flex: none; opacity: 0.6; }
  .meta-sha {
    font: 400 11px/1 "DM Mono", monospace; color: var(--gray-500);
  }
  .meta-time { color: var(--gray-500); }
  .meta-quiz-link {
    font-weight: 600; color: var(--accent); font-size: 12px;
    margin-left: auto;
  }
  .meta-quiz-link:hover { color: var(--accent-hover); }

  /* Sidebar (duplicated pattern) */
  .topbar-back {
    display: grid; place-items: center; width: 32px; height: 32px;
    border-radius: var(--radius-sm); color: var(--muted); transition: all 150ms ease;
  }
  .topbar-back:hover { background: rgba(255, 255, 255, 0.04); color: var(--text); }

  .sidebar-user { display: flex; align-items: center; gap: 10px; padding: 8px; }
  .sidebar-user-avatar { width: 32px; height: 32px; border-radius: 50%; background: rgba(232, 112, 154, 0.15); color: var(--accent); display: grid; place-items: center; font: 700 13px/1 "DM Mono", monospace; flex: none; }
  .sidebar-user-info { display: flex; flex-direction: column; gap: 1px; }
  .sidebar-user-name { font-size: 13px; font-weight: 600; color: var(--gray-800); }
  .sidebar-user-role { font: 400 11px/1 "DM Mono", monospace; color: var(--muted); }

  .bmc-link { display: block; padding: 8px 12px; margin-top: 4px; }
  .bmc-link img { display: block; width: 100%; max-width: 180px; height: auto; border-radius: 8px; transition: opacity 160ms ease, transform 160ms ease; }
  .bmc-link:hover img { opacity: 0.9; transform: translateY(-1px); }
</style>
