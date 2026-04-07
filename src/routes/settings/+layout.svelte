<script lang="ts">
  import SlopBlockLogo from "$lib/components/SlopBlockLogo.svelte";
  import { GITHUB_APP_URL, GITHUB_REPO_URL, GITHUB_APP_INSTALL_URL, BUY_ME_A_COFFEE_URL, BUY_ME_A_COFFEE_IMG } from "$lib/constants";
  import { page } from "$app/state";

  let { data, children } = $props();

  const actor = $derived(data.actor);
  const installations = $derived(data.installations);

  // Derive active installation from URL
  const activeInstallationId = $derived.by(() => {
    const match = page.url.pathname.match(/\/settings\/(\d+)/);
    return match ? match[1] : null;
  });

  // Derive active sub-page
  const activeSubPage = $derived.by(() => {
    const path = page.url.pathname;
    if (path.endsWith("/activity")) return "activity";
    if (activeInstallationId) return "configuration";
    return null;
  });

  const isInstallationsPage = $derived.by(() => {
    return page.url.pathname === "/settings" || page.url.pathname === "/settings/";
  });
</script>

<div class="app-layout">
  <aside class="sidebar">
    <div class="sidebar-brand">
      <div class="sidebar-logo"><SlopBlockLogo /></div>
      <span class="sidebar-title">SlopBlock</span>
    </div>

    <nav class="sidebar-nav">
      <a href="/settings" class="sidebar-link" class:active={isInstallationsPage}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        Installations
      </a>

      {#if installations.length > 0}
        <div class="sidebar-section-label">Accounts</div>
        {#each installations as inst (inst.id)}
          {@const isActive = activeInstallationId === String(inst.id)}
          <div class="sidebar-install" class:expanded={isActive}>
            <a href="/settings/{inst.id}" class="sidebar-install-link" class:active={isActive}>
              <img
                class="sidebar-install-avatar"
                src={inst.account.avatar_url}
                alt={inst.account.login}
                width="20"
                height="20"
              />
              <span class="sidebar-install-name">{inst.account.login}</span>
              <svg class="sidebar-install-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
            {#if isActive}
              <div class="sidebar-sub-links">
                <a
                  href="/settings/{inst.id}"
                  class="sidebar-sub-link"
                  class:active={activeSubPage === "configuration"}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                  Configuration
                </a>
                <a
                  href="/settings/{inst.id}/activity"
                  class="sidebar-sub-link"
                  class:active={activeSubPage === "activity"}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  Activity
                </a>
              </div>
            {/if}
          </div>
        {/each}
      {/if}

      <div class="sidebar-divider"></div>

      <a href={GITHUB_APP_URL} target="_blank" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
        GitHub App
        <svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
      <a href={GITHUB_REPO_URL} target="_blank" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        Documentation
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

  {@render children()}
</div>

<style>
  /* ── Sidebar Section Label ── */
  .sidebar-section-label {
    font: 500 10px/1 "DM Mono", monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gray-400);
    padding: 16px 12px 6px;
  }

  /* ── Installation Items ── */
  .sidebar-install {
    margin-bottom: 1px;
  }

  .sidebar-install-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    color: var(--muted);
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    transition: all 150ms ease;
  }

  .sidebar-install-link:hover {
    background: rgba(255, 255, 255, 0.03);
    color: var(--text);
  }

  .sidebar-install-link.active {
    background: rgba(232, 112, 154, 0.06);
    color: var(--text);
  }

  .sidebar-install-avatar {
    width: 20px;
    height: 20px;
    border-radius: 6px;
    flex: none;
    border: 1px solid var(--line);
  }

  .sidebar-install-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar-install-chevron {
    width: 14px;
    height: 14px;
    flex: none;
    opacity: 0.3;
    transition: transform 200ms ease, opacity 200ms ease;
  }

  .sidebar-install.expanded .sidebar-install-chevron {
    transform: rotate(90deg);
    opacity: 0.6;
  }

  /* ── Sub-links (nested under active installation) ── */
  .sidebar-sub-links {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 2px 0 6px 20px;
    margin-left: 10px;
    border-left: 1px solid var(--line);
  }

  .sidebar-sub-link {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: var(--radius-sm);
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
    text-decoration: none;
    transition: all 150ms ease;
  }

  .sidebar-sub-link:hover {
    background: rgba(255, 255, 255, 0.03);
    color: var(--text);
  }

  .sidebar-sub-link.active {
    background: rgba(232, 112, 154, 0.1);
    color: var(--accent);
    font-weight: 600;
  }

  .sidebar-sub-link svg {
    width: 14px;
    height: 14px;
    flex: none;
    opacity: 0.5;
  }

  .sidebar-sub-link.active svg {
    opacity: 1;
  }

  /* ── Divider ── */
  .sidebar-divider {
    height: 1px;
    background: var(--line);
    margin: 10px 12px;
  }

  /* ── Sidebar User ── */
  .sidebar-user {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
  }

  .sidebar-user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(232, 112, 154, 0.15);
    color: var(--accent);
    display: grid;
    place-items: center;
    font: 700 13px/1 "DM Mono", monospace;
    flex: none;
  }

  .sidebar-user-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .sidebar-user-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--gray-800);
  }

  .sidebar-user-role {
    font: 400 11px/1 "DM Mono", monospace;
    color: var(--muted);
  }

  /* ── Buy Me a Coffee ── */
  .bmc-link {
    display: block;
    padding: 8px 12px;
    margin-top: 4px;
  }

  .bmc-link img {
    display: block;
    width: 100%;
    max-width: 180px;
    height: auto;
    border-radius: 8px;
    transition: opacity 160ms ease, transform 160ms ease;
  }

  .bmc-link:hover img {
    opacity: 0.9;
    transform: translateY(-1px);
  }
</style>
