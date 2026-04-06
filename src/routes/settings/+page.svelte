<script lang="ts">
  import { GITHUB_APP_INSTALL_URL } from "$lib/constants";
  import { page } from "$app/state";

  // Installations come from the layout's data
  const installations = $derived(page.data.installations);
</script>

<svelte:head>
  <title>SlopBlock - installations</title>
</svelte:head>

<div class="main-area">
  <header class="topbar">
    <span class="topbar-title">Installations</span>
    <div class="topbar-spacer"></div>
    <div class="topbar-actions">
      <a class="topbar-btn" href={GITHUB_APP_INSTALL_URL} target="_blank">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add
      </a>
    </div>
  </header>

  <div class="content">
    <div class="page-header">
      <p class="eyebrow">Overview</p>
      <h1>Installations</h1>
      <p class="page-desc">Choose an installation to configure quiz behavior and LLM provider.</p>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-num">{installations.length}</span>
        <span class="stat-label">Installations</span>
      </div>
      <div class="stat-card">
        <span class="stat-num active-dot">Active</span>
        <span class="stat-label">Status</span>
      </div>
    </div>

    {#if installations.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        </div>
        <h2>No installations found</h2>
        <p>Install the SlopBlock GitHub App on an organization or personal account to get started.</p>
        <a class="button primary" style="width: auto; padding: 12px 24px; margin-top: 12px;" href={GITHUB_APP_INSTALL_URL} target="_blank">Install SlopBlock</a>
      </div>
    {:else}
      <div class="install-list">
        {#each installations as inst, i}
          <a
            class="install-card"
            href="/settings/{inst.id}"
            style="animation-delay: {i * 50}ms"
          >
            <img class="avatar" src={inst.account.avatar_url} alt={inst.account.login} width="40" height="40" />
            <div class="install-info">
              <span class="install-name">{inst.account.login}</span>
              <span class="install-type">{inst.account.type} &middot; ID {inst.id}</span>
            </div>
            <div class="install-action">
              <span class="configure-label">Configure</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .page-header {
    margin-bottom: 24px;
  }

  .page-desc {
    margin-top: 6px;
    font-size: 14px;
  }

  /* Stats */
  .stats-row {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px 20px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
  }

  .stat-num {
    font: 700 22px/1 "Playfair Display", serif;
    color: #fff;
  }

  .stat-num.active-dot::before {
    content: "";
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--good);
    box-shadow: 0 0 8px rgba(74, 222, 128, 0.4);
    margin-right: 8px;
    vertical-align: middle;
  }

  .stat-label {
    font: 500 11px/1 "DM Mono", monospace;
    color: var(--muted);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* Empty */
  .empty-state {
    text-align: center;
    padding: 56px 20px;
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    background: var(--surface);
  }

  .empty-icon {
    color: var(--gray-400);
    margin-bottom: 16px;
  }

  .empty-state h2 {
    color: #fff;
    margin-bottom: 8px;
  }

  /* Install list */
  .install-list {
    display: grid;
    gap: 8px;
  }

  .install-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    text-decoration: none;
    color: var(--text);
    transition: all 160ms ease;
    animation: card-in 400ms ease both;
  }

  @keyframes card-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .install-card:hover {
    border-color: rgba(232, 112, 154, 0.2);
    box-shadow: 0 0 30px rgba(232, 112, 154, 0.06);
    transform: translateY(-1px);
  }

  .avatar {
    border-radius: 10px;
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
    font-size: 15px;
    color: #fff;
  }

  .install-type {
    font: 400 12px/1 "DM Mono", monospace;
    color: var(--muted);
  }

  .install-action {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--accent);
    flex: none;
    font-size: 13px;
    font-weight: 500;
  }

  .configure-label {
    opacity: 0;
    transition: opacity 150ms ease;
    font: 500 12px/1 "DM Mono", monospace;
  }

  .install-card:hover .configure-label {
    opacity: 1;
  }

  /* Topbar btn */
  .topbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: var(--radius-md);
    font: 600 12px/1 "DM Mono", monospace;
    text-decoration: none;
    transition: all 160ms ease;
    background: linear-gradient(135deg, var(--pink-400), var(--pink-600));
    color: #fff;
    box-shadow: 0 0 0 1px rgba(232, 112, 154, 0.3), 0 2px 12px rgba(232, 112, 154, 0.2);
  }

  .topbar-btn:hover {
    box-shadow: 0 0 0 1px rgba(232, 112, 154, 0.5), 0 4px 20px rgba(232, 112, 154, 0.3);
    transform: translateY(-1px);
    color: #fff;
  }
</style>
