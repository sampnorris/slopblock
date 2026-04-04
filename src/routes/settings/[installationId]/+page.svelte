<script lang="ts">
  import type { PageData } from "./$types";
  import SearchSelect from "$lib/components/SearchSelect.svelte";

  let { data }: { data: PageData } = $props();

  const installationId = data.installationId;
  const actor = data.actor;

  let saving = $state(false);
  let saveMessage = $state("");
  let saveOk = $state(false);
  let provider = $state<"openrouter" | "manual" | "none">(data.provider as any);
  let hasApiKey = $state(data.hasApiKey);

  // Manual key entry
  let showManualKey = $state(false);
  let manualApiKey = $state("");
  let manualBaseUrl = $state("");
  let settingKey = $state(false);
  let keyMessage = $state("");

  // Settings fields
  let llmGenerationModel = $state(data.settings?.llmGenerationModel ?? "");
  let llmValidationModel = $state(data.settings?.llmValidationModel ?? "");
  let llmSkipModel = $state(data.settings?.llmSkipModel ?? "");
  let questionCountMin = $state(data.settings?.questionCountMin ?? 2);
  let questionCountMax = $state(data.settings?.questionCountMax ?? 5);
  let retryMode = $state(data.settings?.retryMode ?? "new_quiz");
  let skipBots = $state(data.settings?.skipBots ?? true);
  let skipForks = $state(data.settings?.skipForks ?? true);
  let customSystemPrompt = $state(data.settings?.customSystemPrompt ?? "");
  let customQuizInstructions = $state(data.settings?.customQuizInstructions ?? "");

  const defaultModels = [
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-opus-4.1",
    "anthropic/claude-haiku-3.5",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "google/gemini-2.0-flash",
  ];

  interface ModelInfo {
    id: string;
    name: string;
    contextLength?: number;
    promptPrice?: string;
    completionPrice?: string;
  }

  let availableModels = $state<ModelInfo[]>([]);
  let modelsLoading = $state(false);
  let modelsSource = $state<"static" | "openrouter" | "error">("static");

  async function fetchModels() {
    modelsLoading = true;
    try {
      const res = await fetch(`/api/settings/${installationId}/models`, { credentials: "same-origin" });
      const json = await res.json();
      modelsSource = json.source;
      if (json.models?.length) {
        availableModels = json.models;
      }
    } catch {
      modelsSource = "error";
    } finally {
      modelsLoading = false;
    }
  }

  // Fetch models on mount if connected via OpenRouter
  if (typeof window !== "undefined" && data.provider === "openrouter") {
    fetchModels();
  }

  // -- OpenRouter OAuth PKCE --
  async function connectOpenRouter() {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await sha256Base64Url(codeVerifier);

    // Store verifier in sessionStorage for the callback
    sessionStorage.setItem("or_code_verifier", codeVerifier);
    sessionStorage.setItem("or_installation_id", installationId);

    const callbackUrl = `${window.location.origin}/settings/${installationId}`;
    const url = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callbackUrl)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;
    window.location.href = url;
  }

  function generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function sha256Base64Url(input: string): Promise<string> {
    const encoded = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest("SHA-256", encoded);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // Handle OpenRouter callback (code in URL)
  async function handleOpenRouterCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (!code) return;

    const codeVerifier = sessionStorage.getItem("or_code_verifier");
    const storedInstallationId = sessionStorage.getItem("or_installation_id");
    sessionStorage.removeItem("or_code_verifier");
    sessionStorage.removeItem("or_installation_id");

    if (!codeVerifier || storedInstallationId !== installationId) {
      keyMessage = "OAuth state mismatch. Please try again.";
      return;
    }

    // Clean URL
    window.history.replaceState({}, "", window.location.pathname);

    settingKey = true;
    keyMessage = "";
    try {
      const res = await fetch("/auth/openrouter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code, codeVerifier, installationId })
      });
      const json = await res.json();
      if (json.ok) {
        provider = "openrouter";
        hasApiKey = true;
        keyMessage = "Connected to OpenRouter.";
        saveOk = true;
        fetchModels();
      } else {
        keyMessage = json.message || "Failed to connect.";
        saveOk = false;
      }
    } catch {
      keyMessage = "Network error.";
      saveOk = false;
    } finally {
      settingKey = false;
    }
  }

  // Handle manual key
  async function submitManualKey() {
    if (!manualApiKey.trim()) return;
    settingKey = true;
    keyMessage = "";
    try {
      const res = await fetch(`/api/settings/${installationId}/key`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ apiKey: manualApiKey, baseUrl: manualBaseUrl || undefined })
      });
      const json = await res.json();
      if (json.ok) {
        provider = "manual";
        hasApiKey = true;
        keyMessage = "API key saved.";
        saveOk = true;
        manualApiKey = "";
        showManualKey = false;
      } else {
        keyMessage = json.message || "Failed to save.";
        saveOk = false;
      }
    } catch {
      keyMessage = "Network error.";
      saveOk = false;
    } finally {
      settingKey = false;
    }
  }

  async function disconnect() {
    settingKey = true;
    try {
      const res = await fetch(`/api/settings/${installationId}`, {
        method: "DELETE",
        credentials: "same-origin"
      });
      const json = await res.json();
      if (json.ok) {
        provider = "none";
        hasApiKey = false;
        keyMessage = "Disconnected.";
        saveOk = true;
      }
    } catch {
      keyMessage = "Network error.";
      saveOk = false;
    } finally {
      settingKey = false;
    }
  }

  async function save() {
    saving = true;
    saveMessage = "";
    try {
      const res = await fetch(`/api/settings/${installationId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          accountLogin: actor.login,
          llmGenerationModel: llmGenerationModel || undefined,
          llmValidationModel: llmValidationModel || undefined,
          llmSkipModel: llmSkipModel || undefined,
          questionCountMin,
          questionCountMax,
          retryMode,
          skipBots,
          skipForks,
          customSystemPrompt: customSystemPrompt || undefined,
          customQuizInstructions: customQuizInstructions || undefined
        })
      });
      const json = await res.json();
      if (json.ok) {
        saveMessage = "Settings saved.";
        saveOk = true;
      } else {
        saveMessage = json.error || "Failed to save.";
        saveOk = false;
      }
    } catch {
      saveMessage = "Network error.";
      saveOk = false;
    } finally {
      saving = false;
    }
  }

  // Check for OpenRouter callback on mount
  if (typeof window !== "undefined") {
    handleOpenRouterCallback();
  }
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
      <a href="/settings" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        Installations
      </a>
      <a href="/settings/{installationId}" class="sidebar-link active">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        Configuration
      </a>
      <a href="https://github.com/apps/slopblock" target="_blank" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
        GitHub App
      </a>
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="sidebar-user-avatar">{actor.login[0].toUpperCase()}</div>
        <div class="sidebar-user-info">
          <span class="sidebar-user-name">{actor.login}</span>
          <span class="sidebar-user-role">Authenticated</span>
        </div>
      </div>
    </div>
  </aside>

  <!-- Main -->
  <div class="main-area">
    <header class="topbar">
      <a href="/settings" class="topbar-back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
      </a>
      <span class="topbar-title">Installation Settings</span>
      <div class="topbar-spacer"></div>
      <div class="topbar-actions">
        <button class="topbar-btn primary" onclick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </header>

    <div class="content">
      <div class="page-header">
        <h1>Configuration</h1>
        <p>Configure LLM provider and quiz behavior for installation <strong>{installationId}</strong>.</p>
      </div>

      <div class="settings-grid">
        <!-- LLM Provider Connection -->
        <div class="settings-card">
          <div class="settings-card-header">
            <div class="settings-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
            <div>
              <h2>LLM Provider</h2>
              <p class="section-desc">Connect an LLM provider to power quiz generation. Your API key is encrypted at rest.</p>
            </div>
          </div>

          {#if provider === "openrouter"}
            <div class="provider-status connected">
              <span class="status-dot"></span>
              <span>Connected via OpenRouter</span>
            </div>
          {:else if provider === "manual"}
            <div class="provider-status connected">
              <span class="status-dot"></span>
              <span>Connected via API key</span>
            </div>
          {:else}
            <div class="provider-status">
              <span class="status-dot"></span>
              <span>No provider configured</span>
            </div>
          {/if}

          {#if keyMessage}
            <p class="key-msg" class:good={saveOk} class:bad={!saveOk}>{keyMessage}</p>
          {/if}

          <div class="provider-actions">
            {#if provider === "openrouter" || provider === "manual"}
              <button class="button" onclick={disconnect} disabled={settingKey}>
                {provider === "openrouter" ? "Disconnect OpenRouter" : "Remove API key"}
              </button>
            {:else}
              <button class="button primary" onclick={connectOpenRouter} disabled={settingKey}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                Connect with OpenRouter
              </button>
              <button class="button secondary" onclick={() => showManualKey = !showManualKey}>
                {showManualKey ? "Cancel" : "Use API key instead"}
              </button>
            {/if}
          </div>

          {#if showManualKey && provider !== "openrouter" && provider !== "manual"}
            <div class="manual-key">
              <div class="field">
                <label for="manualBaseUrl">Base URL (optional)</label>
                <input id="manualBaseUrl" type="url" bind:value={manualBaseUrl} placeholder="https://api.openai.com/v1" />
                <span class="hint">Leave blank for OpenAI-compatible default. Use for Anthropic, custom endpoints, etc.</span>
              </div>
              <div class="field">
                <label for="manualKey">API Key</label>
                <input id="manualKey" type="password" bind:value={manualApiKey} placeholder="sk-..." />
              </div>
              <button class="button primary" style="margin-top: 4px;" onclick={submitManualKey} disabled={settingKey || !manualApiKey.trim()}>
                {settingKey ? "Saving..." : "Save API Key"}
              </button>
            </div>
          {/if}
        </div>

        <!-- Models -->
        <div class="settings-card">
          <div class="settings-card-header">
            <div class="settings-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            </div>
            <div>
              <h2>Models</h2>
              <p class="section-desc">
                {#if modelsLoading}
                  Loading available models...
                {:else if modelsSource === "openrouter"}
                  Showing {availableModels.length} models from your OpenRouter account.
                {:else}
                  Override which models are used for each stage. Leave blank for defaults.
                {/if}
              </p>
            </div>
          </div>

          {#if availableModels.length > 0}
            {@const modelOptions = availableModels.map((m) => ({ value: m.id, label: m.name, detail: m.id }))}
            <div class="field">
              <label for="genModel">Generation Model</label>
              <SearchSelect options={modelOptions} bind:value={llmGenerationModel} placeholder="Search models..." emptyLabel="Default (anthropic/claude-sonnet-4.5)" id="genModel" />
            </div>
            <div class="field">
              <label for="valModel">Validation Model</label>
              <SearchSelect options={modelOptions} bind:value={llmValidationModel} placeholder="Search models..." emptyLabel="Default (anthropic/claude-opus-4.1)" id="valModel" />
            </div>
            <div class="field">
              <label for="skipModel">Skip Evaluation Model</label>
              <SearchSelect options={modelOptions} bind:value={llmSkipModel} placeholder="Search models..." emptyLabel="Default (anthropic/claude-sonnet-4.5)" id="skipModel" />
            </div>
          {:else}
            <div class="field">
              <label for="genModel">Generation Model</label>
              <input id="genModel" list="model-list" bind:value={llmGenerationModel} placeholder="anthropic/claude-sonnet-4.5" />
            </div>
            <div class="field">
              <label for="valModel">Validation Model</label>
              <input id="valModel" list="model-list" bind:value={llmValidationModel} placeholder="anthropic/claude-opus-4.1" />
            </div>
            <div class="field">
              <label for="skipModel">Skip Evaluation Model</label>
              <input id="skipModel" list="model-list" bind:value={llmSkipModel} placeholder="anthropic/claude-sonnet-4.5" />
            </div>
            <datalist id="model-list">
              {#each defaultModels as m}
                <option value={m}></option>
              {/each}
            </datalist>
          {/if}
        </div>

        <!-- Quiz Behavior -->
        <div class="settings-card">
          <div class="settings-card-header">
            <div class="settings-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </div>
            <div>
              <h2>Quiz Behavior</h2>
              <p class="section-desc">Control how quizzes are generated and presented.</p>
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="qmin">Min Questions</label>
              <input id="qmin" type="number" min="1" max="10" bind:value={questionCountMin} />
            </div>
            <div class="field">
              <label for="qmax">Max Questions</label>
              <input id="qmax" type="number" min="1" max="10" bind:value={questionCountMax} />
            </div>
          </div>

          <div class="field">
            <label for="retry">Retry Mode</label>
            <select id="retry" bind:value={retryMode}>
              <option value="new_quiz">Generate new quiz</option>
              <option value="same_quiz">Retry same quiz</option>
              <option value="maintainer_rerun">Maintainer re-run only</option>
            </select>
          </div>

          <div class="toggle-row">
            <label class="toggle">
              <input type="checkbox" bind:checked={skipBots} />
              <span class="toggle-slider"></span>
              <span class="toggle-label">Skip bot PRs</span>
            </label>
            <label class="toggle">
              <input type="checkbox" bind:checked={skipForks} />
              <span class="toggle-slider"></span>
              <span class="toggle-label">Skip fork PRs</span>
            </label>
          </div>
        </div>

        <!-- Custom Prompts -->
        <div class="settings-card">
          <div class="settings-card-header">
            <div class="settings-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </div>
            <div>
              <h2>Custom Prompts</h2>
              <p class="section-desc">Customize how quizzes are generated. These are appended to the default prompts.</p>
            </div>
          </div>

          <div class="field">
            <label for="systemPrompt">System Prompt (appended to default)</label>
            <textarea id="systemPrompt" bind:value={customSystemPrompt} rows="3" placeholder="e.g. Focus on security implications. Ask about error handling. Use formal language."></textarea>
            <span class="hint">Added to the LLM system prompt. Use this to steer the overall tone, focus areas, or domain-specific context.</span>
          </div>
          <div class="field">
            <label for="quizInstructions">Quiz Instructions (appended to default)</label>
            <textarea id="quizInstructions" bind:value={customQuizInstructions} rows="3" placeholder="e.g. Always include a question about test coverage. Avoid questions about import ordering."></textarea>
            <span class="hint">Added to the quiz generation instructions. Use this for specific question requirements or exclusions.</span>
          </div>
        </div>
      </div>

      <!-- Bottom save -->
      <div class="bottom-actions">
        <button class="button primary" style="width: auto; padding: 14px 32px;" onclick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {#if saveMessage}
          <p class="save-msg" class:good={saveOk} class:bad={!saveOk}>{saveMessage}</p>
        {/if}
      </div>
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

  .page-header p strong {
    color: var(--gray-800);
  }

  /* Settings grid */
  .settings-grid {
    display: grid;
    gap: 20px;
  }

  .settings-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    padding: 28px;
    box-shadow: var(--shadow-card);
  }

  .settings-card-header {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
  }

  .settings-card-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--pink-50);
    display: grid;
    place-items: center;
    flex: none;
  }

  .settings-card-icon svg {
    width: 22px;
    height: 22px;
    color: var(--pink-500);
  }

  .settings-card-header h2 {
    margin-bottom: 2px;
  }

  .section-desc {
    font-size: 14px;
    margin-top: 2px;
    line-height: 1.5;
  }

  /* Provider status */
  .provider-status {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 18px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 500;
    color: var(--muted);
    background: var(--gray-50);
  }

  .provider-status.connected {
    border-color: rgba(22, 163, 74, 0.25);
    color: var(--good);
    background: var(--good-light);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--gray-400);
    flex: none;
  }

  .provider-status.connected .status-dot {
    background: var(--good);
    box-shadow: 0 0 6px rgba(22, 163, 74, 0.4);
  }

  .provider-actions {
    display: flex;
    gap: 10px;
    margin-top: 16px;
  }

  .button.secondary {
    background: transparent;
    border-color: var(--line);
    color: var(--muted);
  }

  .button.secondary:hover {
    border-color: var(--gray-300);
    color: var(--text);
    background: var(--gray-50);
  }

  .manual-key {
    margin-top: 16px;
    padding: 20px;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--gray-50);
    display: grid;
    gap: 12px;
  }

  /* Fields */
  .field {
    margin-top: 16px;
  }

  .field label {
    display: block;
    font-size: 13px;
    color: var(--gray-600);
    margin-bottom: 6px;
    font-weight: 600;
  }

  .field textarea,
  .field input,
  .field select {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 14px;
    outline: none;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }

  .field textarea {
    resize: vertical;
    min-height: 72px;
  }

  .field textarea:focus,
  .field input:focus,
  .field select:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(212, 80, 126, 0.1);
  }

  .field select {
    appearance: auto;
    cursor: pointer;
  }

  .hint {
    display: block;
    font-size: 12px;
    color: var(--muted);
    margin-top: 6px;
    line-height: 1.5;
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  .field-row .field {
    margin-top: 0;
  }

  /* Toggle switches */
  .toggle-row {
    display: flex;
    gap: 24px;
    margin-top: 18px;
    flex-wrap: wrap;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 14px;
    user-select: none;
  }

  .toggle input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    width: 40px;
    height: 22px;
    border-radius: 11px;
    background: var(--gray-300);
    position: relative;
    transition: background 200ms ease;
    flex: none;
  }

  .toggle-slider::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    transition: transform 200ms ease;
  }

  .toggle input:checked + .toggle-slider {
    background: var(--pink-500);
  }

  .toggle input:checked + .toggle-slider::after {
    transform: translateX(18px);
  }

  .toggle-label {
    color: var(--gray-700);
    font-weight: 500;
  }

  /* Messages */
  .save-msg, .key-msg {
    font-size: 14px;
    font-weight: 500;
    margin-top: 8px;
  }

  .save-msg.good, .key-msg.good { color: var(--good); }
  .save-msg.bad, .key-msg.bad { color: var(--bad); }

  /* Bottom actions */
  .bottom-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid var(--line);
  }

  /* Topbar */
  .topbar-back {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-sm);
    color: var(--gray-600);
    transition: all 150ms ease;
  }

  .topbar-back:hover {
    background: var(--gray-100);
    color: var(--gray-800);
  }

  .topbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 150ms ease;
    font-family: inherit;
  }

  .topbar-btn.primary {
    background: linear-gradient(135deg, var(--pink-400), var(--pink-600));
    color: #fff;
    box-shadow: 0 2px 8px rgba(212, 80, 126, 0.25);
  }

  .topbar-btn.primary:hover {
    box-shadow: 0 4px 16px rgba(212, 80, 126, 0.35);
    transform: translateY(-1px);
  }

  .topbar-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
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
</style>
