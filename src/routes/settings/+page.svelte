<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>slopblock - settings</title>
</svelte:head>

<div class="app-layout">
  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-brand">
      <div class="sidebar-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
      <span class="sidebar-title">slopblock</span>
    </div>

    <nav class="sidebar-nav">
      <a href="/settings" class="sidebar-link active">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        Installations
      </a>
      <a href="https://github.com/apps/slopblock" target="_blank" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
        GitHub App
      </a>
      <a href="https://github.com/sampnorris/slopblock" target="_blank" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        Documentation
      </a>
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="sidebar-user-avatar">{data.actor.login[0].toUpperCase()}</div>
        <div class="sidebar-user-info">
          <span class="sidebar-user-name">{data.actor.login}</span>
          <span class="sidebar-user-role">Authenticated</span>
        </div>
      </div>
    </div>
  </aside>

  <!-- Main -->
  <div class="main-area">
    <header class="topbar">
      <span class="topbar-title">Installations</span>
      <div class="topbar-spacer"></div>
      <div class="topbar-actions">
        <a class="topbar-btn primary" href="https://github.com/apps/slopblock/installations/new" target="_blank">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Installation
        </a>
      </div>
    </header>

    <div class="content">
      <div class="page-header">
        <h1>Settings</h1>
        <p>Choose an installation to configure slopblock's quiz behavior and LLM provider.</p>
      </div>

      <!-- Stats cards (like the reference) -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-label">Installations</span>
            <span class="stat-value">{data.installations.length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-label">Status</span>
            <span class="stat-value">Active</span>
          </div>
        </div>
      </div>

      <!-- Installations list -->
      {#if data.installations.length === 0}
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          </div>
          <h2>No installations found</h2>
          <p>Install the slopblock GitHub App on a repository to get started.</p>
          <a class="button primary" style="width: auto; padding: 12px 24px; margin-top: 8px;" href="https://github.com/apps/slopblock/installations/new" target="_blank">Install slopblock</a>
        </div>
      {:else}
        <div class="install-list">
          {#each data.installations as inst}
            <a class="install-card" href="/settings/{inst.id}">
              <img class="avatar" src={inst.account.avatar_url} alt={inst.account.login} width="44" height="44" />
              <div class="install-info">
                <span class="install-name">{inst.account.login}</span>
                <span class="install-type">{inst.account.type} &middot; ID {inst.id}</span>
              </div>
              <div class="install-action">
                <span class="configure-label">Configure</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .page-header {
    margin-bottom: 24px;
  }

  .page-header p {
    margin-top: 6px;
    font-size: 15px;
  }

  /* Stats row */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 20px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
  }

  .stat-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--pink-50);
    display: grid;
    place-items: center;
    flex: none;
  }

  .stat-icon svg {
    width: 22px;
    height: 22px;
    color: var(--pink-500);
  }

  .stat-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-label {
    font-size: 13px;
    color: var(--muted);
    font-weight: 500;
  }

  .stat-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--gray-900);
    letter-spacing: -0.02em;
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
  }

  .empty-icon {
    color: var(--gray-300);
    margin-bottom: 16px;
  }

  .empty-state h2 {
    color: var(--gray-700);
    margin-bottom: 8px;
  }

  /* Install list */
  .install-list {
    display: grid;
    gap: 10px;
  }

  .install-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 20px;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    text-decoration: none;
    color: var(--text);
    transition: all 150ms ease;
    box-shadow: var(--shadow-card);
  }

  .install-card:hover {
    border-color: var(--pink-200);
    box-shadow: 0 4px 20px rgba(212, 80, 126, 0.08);
    transform: translateY(-1px);
  }

  .avatar {
    border-radius: 12px;
    flex: none;
    border: 1px solid var(--line);
  }

  .install-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .install-name {
    font-weight: 600;
    font-size: 16px;
    color: var(--gray-800);
  }

  .install-type {
    font-size: 13px;
    color: var(--muted);
  }

  .install-action {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--accent);
    flex: none;
    font-size: 14px;
    font-weight: 500;
  }

  .configure-label {
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .install-card:hover .configure-label {
    opacity: 1;
  }

  /* Sidebar user */
  .sidebar-user {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
  }

  .sidebar-user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--pink-100);
    color: var(--pink-600);
    display: grid;
    place-items: center;
    font-weight: 700;
    font-size: 14px;
    flex: none;
  }

  .sidebar-user-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .sidebar-user-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--gray-800);
  }

  .sidebar-user-role {
    font-size: 12px;
    color: var(--muted);
  }

  /* Topbar action buttons */
  .topbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    transition: all 150ms ease;
  }

  .topbar-btn.primary {
    background: linear-gradient(135deg, var(--pink-400), var(--pink-600));
    color: #fff;
    box-shadow: 0 2px 8px rgba(212, 80, 126, 0.25);
  }

  .topbar-btn.primary:hover {
    box-shadow: 0 4px 16px rgba(212, 80, 126, 0.35);
    transform: translateY(-1px);
    color: #fff;
  }
</style>
