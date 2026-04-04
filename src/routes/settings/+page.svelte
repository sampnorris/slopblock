<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>slopblock - settings</title>
</svelte:head>

<main class="card">
  <div class="eyebrow">slopblock</div>
  <h1>Settings</h1>
  <p>Choose an installation to configure.</p>
  <div class="meta">
    <div class="pill">Signed in as {data.actor.login}</div>
  </div>

  <div class="stack">
    {#if data.installations.length === 0}
      <div class="empty">
        <p>No installations found. Install the slopblock GitHub App on a repository first.</p>
        <a class="button" href="https://github.com/apps/slopblock/installations/new" target="_blank">Install slopblock</a>
      </div>
    {:else}
      {#each data.installations as inst}
        <a class="install-card" href="/settings/{inst.id}">
          <img class="avatar" src={inst.account.avatar_url} alt={inst.account.login} width="40" height="40" />
          <div class="install-info">
            <span class="install-name">{inst.account.login}</span>
            <span class="install-type">{inst.account.type} &middot; ID {inst.id}</span>
          </div>
          <span class="arrow">&rarr;</span>
        </a>
      {/each}
    {/if}
  </div>
</main>

<style>
  .empty {
    text-align: center;
    padding: 20px 0;
  }

  .install-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: rgba(255,255,255,0.02);
    text-decoration: none;
    color: var(--text);
    transition: border-color 150ms ease, background 150ms ease, transform 120ms ease;
  }

  .install-card:hover {
    border-color: rgba(102,227,196,0.4);
    background: rgba(102,227,196,0.05);
    transform: translateY(-1px);
  }

  .avatar {
    border-radius: 10px;
    flex: none;
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
  }

  .install-type {
    font-size: 13px;
    color: var(--muted);
  }

  .arrow {
    font-size: 20px;
    color: var(--accent);
    flex: none;
  }
</style>
