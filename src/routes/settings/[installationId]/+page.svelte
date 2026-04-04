<script lang="ts">
  import type { PageData } from "./$types";

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
          skipForks
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

<main class="card">
  <div class="eyebrow">slopblock</div>
  <h1>Installation Settings</h1>
  <p>Configure LLM provider and quiz behavior for installation <strong>{installationId}</strong>.</p>
  <div class="meta">
    <div class="pill">Signed in as {actor.login}</div>
  </div>

  <div class="stack">
    <!-- LLM Provider Connection -->
    <section class="section">
      <h2>LLM Provider</h2>
      <p class="section-desc">Connect an LLM provider to power quiz generation. This is required -- slopblock won't generate quizzes without it. Your API key is encrypted at rest and never exposed.</p>

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
          <button class="button" onclick={submitManualKey} disabled={settingKey || !manualApiKey.trim()}>
            {settingKey ? "Saving..." : "Save API Key"}
          </button>
        </div>
      {/if}
    </section>

    <!-- Models -->
    <section class="section">
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

      {#if availableModels.length > 0}
        <div class="field">
          <label for="genModel">Generation Model</label>
          <select id="genModel" bind:value={llmGenerationModel}>
            <option value="">Default (anthropic/claude-sonnet-4.5)</option>
            {#each availableModels as m}
              <option value={m.id}>{m.name} ({m.id})</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <label for="valModel">Validation Model</label>
          <select id="valModel" bind:value={llmValidationModel}>
            <option value="">Default (anthropic/claude-opus-4.1)</option>
            {#each availableModels as m}
              <option value={m.id}>{m.name} ({m.id})</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <label for="skipModel">Skip Evaluation Model</label>
          <select id="skipModel" bind:value={llmSkipModel}>
            <option value="">Default (anthropic/claude-sonnet-4.5)</option>
            {#each availableModels as m}
              <option value={m.id}>{m.name} ({m.id})</option>
            {/each}
          </select>
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
    </section>

    <!-- Quiz Behavior -->
    <section class="section">
      <h2>Quiz Behavior</h2>
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

      <div class="field-row">
        <label class="toggle">
          <input type="checkbox" bind:checked={skipBots} />
          <span>Skip bot PRs</span>
        </label>
        <label class="toggle">
          <input type="checkbox" bind:checked={skipForks} />
          <span>Skip fork PRs</span>
        </label>
      </div>
    </section>

    <!-- Save -->
    <button class="button primary" onclick={save} disabled={saving}>
      {saving ? "Saving..." : "Save Settings"}
    </button>

    {#if saveMessage}
      <p class="save-msg" class:good={saveOk} class:bad={!saveOk}>{saveMessage}</p>
    {/if}
  </div>
</main>

<style>
  .section {
    border-top: 1px solid var(--line);
    padding-top: 20px;
  }

  .section-desc {
    font-size: 14px;
    margin-top: 4px;
    margin-bottom: 14px;
  }

  .provider-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border: 1px solid var(--line);
    border-radius: 12px;
    font-size: 14px;
    color: var(--muted);
  }

  .provider-status.connected {
    border-color: rgba(143, 255, 216, 0.3);
    color: var(--good);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--muted);
    flex: none;
  }

  .provider-status.connected .status-dot {
    background: var(--good);
  }

  .provider-actions {
    display: flex;
    gap: 10px;
    margin-top: 14px;
  }

  .button.secondary {
    background: transparent;
    border-color: var(--line);
    color: var(--muted);
  }

  .button.secondary:hover {
    border-color: rgba(148, 163, 184, 0.4);
    color: var(--text);
  }

  .manual-key {
    margin-top: 14px;
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: 14px;
    display: grid;
    gap: 12px;
  }

  .field {
    margin-top: 14px;
  }

  .field label {
    display: block;
    font-size: 13px;
    color: var(--muted);
    margin-bottom: 6px;
    font-weight: 500;
  }

  .field input,
  .field select {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: rgba(255,255,255,0.04);
    color: var(--text);
    font: inherit;
    font-size: 14px;
    outline: none;
    transition: border-color 150ms ease;
  }

  .field input:focus,
  .field select:focus {
    border-color: var(--accent);
  }

  .field select {
    appearance: auto;
    cursor: pointer;
  }

  .field select option {
    background: #0c1422;
    color: var(--text);
  }

  .hint {
    display: block;
    font-size: 12px;
    color: var(--muted);
    margin-top: 4px;
    opacity: 0.7;
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 14px;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text);
  }

  .toggle input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .save-msg, .key-msg {
    font-size: 14px;
    font-weight: 500;
    margin-top: 8px;
  }

  .save-msg.good, .key-msg.good { color: var(--good); }
  .save-msg.bad, .key-msg.bad { color: var(--bad); }
</style>
