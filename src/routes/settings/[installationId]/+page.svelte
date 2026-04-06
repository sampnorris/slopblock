<script lang="ts">
  import SlopBlockLogo from "$lib/components/SlopBlockLogo.svelte";
  import { GITHUB_APP_URL, GITHUB_MARKETPLACE_URL, BUY_ME_A_COFFEE_URL, BUY_ME_A_COFFEE_IMG } from "$lib/constants";
  import type { PageData } from "./$types";
  import SearchSelect from "$lib/components/SearchSelect.svelte";

  let { data }: { data: PageData } = $props();

  const installationId = data.installationId;
  const actor = data.actor;
  const isPaid = data.marketplacePlan === "paid";
  const isOrg = data.accountType === "Organization";

  let saving = $state(false);
  let saveMessage = $state("");
  let saveOk = $state(false);
  let provider = $state<"openrouter" | "manual" | "none">(data.provider as any);
  let hasApiKey = $state(data.hasApiKey);
  let hasBaseUrl = $state(Boolean(data.settings?.llmBaseUrl));

  let showManualKey = $state(false);
  let manualApiKey = $state("");
  let manualBaseUrl = $state("");
  let settingKey = $state(false);
  let keyMessage = $state("");

  let llmGenerationModel = $state(data.settings?.llmGenerationModel ?? "");
  let llmValidationModel = $state(data.settings?.llmValidationModel ?? "");
  let llmSkipModel = $state(data.settings?.llmSkipModel ?? "");
  let questionCountMin = $state(data.settings?.questionCountMin ?? 2);
  let questionCountMax = $state(data.settings?.questionCountMax ?? 5);
  let quizGenerationMaxAttempts = $state(data.settings?.quizGenerationMaxAttempts ?? 3);
  let llmMaxJsonAttempts = $state(data.settings?.llmMaxJsonAttempts ?? 2);
  let allowBestEffortFallback = $state(data.settings?.allowBestEffortFallback ?? true);
  let retryMode = $state(data.settings?.retryMode ?? "same_quiz");
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

  const providerConnected = $derived(hasApiKey && hasBaseUrl);
  const modelsConfigured = $derived(
    !!llmGenerationModel.trim() && !!llmValidationModel.trim() && !!llmSkipModel.trim()
  );

  async function fetchModels() {
    modelsLoading = true;
    try {
      const res = await fetch(`/api/settings/${installationId}/models`, { credentials: "same-origin" });
      const json = await res.json();
      modelsSource = json.source;
      if (json.models?.length) { availableModels = json.models; }
    } catch { modelsSource = "error"; }
    finally { modelsLoading = false; }
  }

  if (typeof window !== "undefined" && data.provider === "openrouter") { fetchModels(); }

  async function connectOpenRouter() {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await sha256Base64Url(codeVerifier);
    sessionStorage.setItem("or_code_verifier", codeVerifier);
    sessionStorage.setItem("or_installation_id", installationId);
    const callbackUrl = `${window.location.origin}/settings/${installationId}`;
    const url = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callbackUrl)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;
    window.location.href = url;
  }

  function generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function sha256Base64Url(input: string): Promise<string> {
    const encoded = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest("SHA-256", encoded);
    return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function handleOpenRouterCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (!code) return;
    const codeVerifier = sessionStorage.getItem("or_code_verifier");
    const storedInstallationId = sessionStorage.getItem("or_installation_id");
    sessionStorage.removeItem("or_code_verifier");
    sessionStorage.removeItem("or_installation_id");
    if (!codeVerifier || storedInstallationId !== installationId) { keyMessage = "OAuth state mismatch. Please try again."; return; }
    window.history.replaceState({}, "", window.location.pathname);
    settingKey = true; keyMessage = "";
    try {
      const res = await fetch("/auth/openrouter", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ code, codeVerifier, installationId }) });
      const json = await res.json();
      if (json.ok) { provider = "openrouter"; hasApiKey = true; hasBaseUrl = true; keyMessage = "Connected to OpenRouter."; saveOk = true; fetchModels(); }
      else { keyMessage = json.message || "Failed to connect."; saveOk = false; }
    } catch { keyMessage = "Network error."; saveOk = false; }
    finally { settingKey = false; }
  }

  async function submitManualKey() {
    if (!manualApiKey.trim() || !manualBaseUrl.trim()) return;
    settingKey = true; keyMessage = "";
    try {
      const res = await fetch(`/api/settings/${installationId}/key`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ apiKey: manualApiKey, baseUrl: manualBaseUrl || undefined }) });
      const json = await res.json();
      if (json.ok) { provider = "manual"; hasApiKey = true; hasBaseUrl = true; keyMessage = "API key saved."; saveOk = true; manualApiKey = ""; manualBaseUrl = ""; showManualKey = false; }
      else { keyMessage = json.message || "Failed to save."; saveOk = false; }
    } catch { keyMessage = "Network error."; saveOk = false; }
    finally { settingKey = false; }
  }

  async function disconnect() {
    settingKey = true;
    try {
      const res = await fetch(`/api/settings/${installationId}`, { method: "DELETE", credentials: "same-origin" });
      const json = await res.json();
      if (json.ok) { provider = "none"; hasApiKey = false; hasBaseUrl = false; keyMessage = "Disconnected."; saveOk = true; }
    } catch { keyMessage = "Network error."; saveOk = false; }
    finally { settingKey = false; }
  }

  async function save() {
    if (!providerConnected) { saveMessage = "Connect OpenRouter or provide an API key and base URL before saving."; saveOk = false; return; }
    if (!modelsConfigured) { saveMessage = "Select generation, validation, and skip models before saving."; saveOk = false; return; }
    saving = true; saveMessage = "";
    try {
      const res = await fetch(`/api/settings/${installationId}`, { method: "PUT", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ accountLogin: actor.login, llmGenerationModel: llmGenerationModel.trim(), llmValidationModel: llmValidationModel.trim(), llmSkipModel: llmSkipModel.trim(), questionCountMin, questionCountMax, quizGenerationMaxAttempts, llmMaxJsonAttempts, allowBestEffortFallback, retryMode, skipBots, skipForks, customSystemPrompt: customSystemPrompt || undefined, customQuizInstructions: customQuizInstructions || undefined }) });
      const json = await res.json();
      if (json.ok) { saveMessage = "Settings saved."; saveOk = true; }
      else { saveMessage = json.error || "Failed to save."; saveOk = false; }
    } catch { saveMessage = "Network error."; saveOk = false; }
    finally { saving = false; }
  }

  if (typeof window !== "undefined") { handleOpenRouterCallback(); }
</script>

<svelte:head>
  <title>SlopBlock - settings</title>
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
      <a href="/settings/{installationId}" class="sidebar-link active">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        Configuration
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
      <a href="/settings" class="topbar-back" aria-label="Back to installations">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
      </a>
      <span class="topbar-title">Configuration</span>
      <div class="topbar-spacer"></div>
      <div class="topbar-actions">
        <button class="topbar-btn" onclick={save} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </header>

    <div class="content">
      <div class="page-header">
        <div class="page-header-row">
          <h1>Installation <span class="mono">{installationId}</span></h1>
          <div class="plan-badges">
            <span class="badge" class:badge-paid={isPaid} class:badge-free={!isPaid}>
              {isPaid ? "Paid" : "Free"}
            </span>
            {#if isOrg}
              <span class="badge badge-org">Organization</span>
            {/if}
          </div>
        </div>
        <p>Configure LLM provider and quiz behavior.</p>
        {#if !isPaid && isOrg}
          <div class="plan-warning">
            Organization repositories require a paid plan. Quiz generation is blocked.
            <a href={GITHUB_MARKETPLACE_URL} target="_blank">Upgrade</a>
          </div>
        {:else if !isPaid}
          <div class="plan-notice">
            Free plan: up to 10 quiz generations per day, personal repositories only.
            <a href={GITHUB_MARKETPLACE_URL} target="_blank">Upgrade for unlimited</a>
          </div>
        {/if}
      </div>

      <div class="settings-grid">
        <!-- LLM Provider -->
        <section class="sc">
          <div class="sc-head">
            <h2>LLM Provider</h2>
            <p class="sc-desc">Connect OpenRouter or provide an API key and base URL.</p>
          </div>

          {#if provider === "openrouter"}
            <div class="provider-status connected"><span class="status-dot"></span><span>Connected via OpenRouter</span></div>
          {:else if provider === "manual"}
            <div class="provider-status connected"><span class="status-dot"></span><span>Connected via API key</span></div>
          {:else}
            <div class="provider-status"><span class="status-dot"></span><span>No provider configured</span></div>
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
              <button class="button primary" onclick={connectOpenRouter} disabled={settingKey}>Connect with OpenRouter</button>
              <button class="button" onclick={() => showManualKey = !showManualKey}>
                {showManualKey ? "Cancel" : "Use API key instead"}
              </button>
            {/if}
          </div>

          {#if showManualKey && provider !== "openrouter" && provider !== "manual"}
            <div class="manual-key">
              <div class="field">
                <label for="manualBaseUrl">Base URL</label>
                <input id="manualBaseUrl" type="url" bind:value={manualBaseUrl} placeholder="https://api.openai.com/v1" />
                <span class="hint">Required. Use the full OpenAI-compatible endpoint.</span>
              </div>
              <div class="field">
                <label for="manualKey">API Key</label>
                <input id="manualKey" type="password" bind:value={manualApiKey} placeholder="sk-..." />
              </div>
              <button class="button primary" style="margin-top: 4px;" onclick={submitManualKey} disabled={settingKey || !manualApiKey.trim() || !manualBaseUrl.trim()}>
                {settingKey ? "Saving..." : "Save API Key"}
              </button>
            </div>
          {/if}
        </section>

        <!-- Models -->
        <section class="sc">
          <div class="sc-head">
            <h2>Models</h2>
            <p class="sc-desc">
              {#if modelsLoading}Loading available models...
              {:else if modelsSource === "openrouter"}Showing {availableModels.length} models from OpenRouter.
              {:else}Select the required models for each stage.{/if}
            </p>
          </div>

          {#if availableModels.length > 0}
            {@const modelOptions = availableModels.map((m) => ({ value: m.id, label: m.name, detail: m.id }))}
            <div class="field"><label for="genModel">Generation Model</label><SearchSelect options={modelOptions} bind:value={llmGenerationModel} placeholder="Search models..." emptyLabel="No model selected" id="genModel" /><span class="hint">Creates the quiz content. Pick your strongest diff-reasoning model.</span></div>
            <div class="field"><label for="valModel">Validation Model</label><SearchSelect options={modelOptions} bind:value={llmValidationModel} placeholder="Search models..." emptyLabel="No model selected" id="valModel" /><span class="hint">Reviews the generated quiz for grounding and structural issues.</span></div>
            <div class="field"><label for="skipModel">Skip Evaluation Model</label><SearchSelect options={modelOptions} bind:value={llmSkipModel} placeholder="Search models..." emptyLabel="No model selected" id="skipModel" /><span class="hint">Decides whether an obvious PR can skip the quiz entirely.</span></div>
          {:else}
            <div class="field"><label for="genModel">Generation Model</label><input id="genModel" list="model-list" bind:value={llmGenerationModel} placeholder="Select or enter a model" /><span class="hint">Creates the quiz content. Pick your strongest diff-reasoning model.</span></div>
            <div class="field"><label for="valModel">Validation Model</label><input id="valModel" list="model-list" bind:value={llmValidationModel} placeholder="Select or enter a model" /><span class="hint">Reviews the generated quiz for grounding and structural issues.</span></div>
            <div class="field"><label for="skipModel">Skip Evaluation Model</label><input id="skipModel" list="model-list" bind:value={llmSkipModel} placeholder="Select or enter a model" /><span class="hint">Decides whether an obvious PR can skip the quiz entirely.</span></div>
            <datalist id="model-list">{#each defaultModels as m}<option value={m}></option>{/each}</datalist>
          {/if}
        </section>

        <!-- Quiz Behavior -->
        <section class="sc">
          <div class="sc-head">
            <h2>Quiz Behavior</h2>
            <p class="sc-desc">Control how quizzes are generated and presented.</p>
          </div>

          <div class="field-row">
            <div class="field"><label for="qmin">Min Questions</label><input id="qmin" type="number" min="1" max="10" bind:value={questionCountMin} /></div>
            <div class="field"><label for="qmax">Max Questions</label><input id="qmax" type="number" min="1" max="10" bind:value={questionCountMax} /></div>
          </div>
          <div class="field-row">
            <div class="field"><label for="generationAttempts">Generation Attempts</label><input id="generationAttempts" type="number" min="1" max="10" bind:value={quizGenerationMaxAttempts} /><span class="hint">Full generate-and-validate passes before giving up.</span></div>
            <div class="field"><label for="jsonAttempts">LLM JSON Attempts</label><input id="jsonAttempts" type="number" min="1" max="10" bind:value={llmMaxJsonAttempts} /><span class="hint">Retries when a model sends malformed JSON.</span></div>
          </div>

          <div class="field">
            <label for="retry">Answer Mode</label>
            <select id="retry" bind:value={retryMode}>
              <option value="same_quiz">Explain mistakes and retry same quiz</option>
              <option value="new_quiz">Generate a new quiz after mistakes</option>
              <option value="maintainer_rerun">Maintainer re-run only</option>
            </select>
          </div>

          <div class="toggle-row">
            <label class="toggle"><input type="checkbox" bind:checked={allowBestEffortFallback} /><span class="toggle-slider"></span><span class="toggle-label">Allow best-effort fallback quiz</span></label>
          </div>
          <p class="sc-desc" style="margin-top: -4px;">Keep the best structurally valid quiz even if the validator never fully approves one.</p>

          <div class="toggle-row">
            <label class="toggle"><input type="checkbox" bind:checked={skipBots} /><span class="toggle-slider"></span><span class="toggle-label">Skip bot PRs</span></label>
            <label class="toggle"><input type="checkbox" bind:checked={skipForks} /><span class="toggle-slider"></span><span class="toggle-label">Skip fork PRs</span></label>
          </div>
        </section>

        <!-- Custom Prompts -->
        <section class="sc" class:sc-locked={!isPaid}>
          <div class="sc-head">
            <div class="sc-head-row">
              <h2>Custom Prompts</h2>
              {#if !isPaid}
                <span class="paid-badge">Paid</span>
              {/if}
            </div>
            <p class="sc-desc">Appended to the default prompts.</p>
          </div>
          {#if isPaid}
            <div class="field"><label for="systemPrompt">System Prompt</label><textarea id="systemPrompt" bind:value={customSystemPrompt} rows="3" placeholder="e.g. Focus on security implications..."></textarea><span class="hint">Steers the overall tone, focus areas, or domain-specific context.</span></div>
            <div class="field"><label for="quizInstructions">Quiz Instructions</label><textarea id="quizInstructions" bind:value={customQuizInstructions} rows="3" placeholder="e.g. Always include a question about test coverage..."></textarea><span class="hint">Specific question requirements or exclusions.</span></div>
          {:else}
            <div class="upgrade-gate">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Custom prompts are available on the paid plan.
              <a href={GITHUB_MARKETPLACE_URL} target="_blank">Upgrade on GitHub Marketplace</a>
            </div>
          {/if}
        </section>
      </div>

      <div class="bottom-actions">
        <button class="button primary" style="width: auto; padding: 12px 28px;" onclick={save} disabled={saving}>
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
  .page-header { margin-bottom: 24px; }
  .page-header p { margin-top: 4px; font-size: 14px; }
  .mono { font: 500 inherit "DM Mono", monospace; color: var(--accent); }

  .page-header-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

  .plan-badges { display: flex; gap: 6px; }
  .badge {
    display: inline-flex; align-items: center;
    padding: 3px 9px; border-radius: 999px;
    font: 600 11px/1 "DM Mono", monospace; letter-spacing: 0.04em;
  }
  .badge-paid { background: rgba(232, 112, 154, 0.12); color: var(--accent); border: 1px solid rgba(232, 112, 154, 0.3); }
  .badge-free { background: var(--gray-50); color: var(--muted); border: 1px solid var(--line); }
  .badge-org { background: rgba(124, 58, 237, 0.08); color: #7c3aed; border: 1px solid rgba(124, 58, 237, 0.25); }

  .plan-notice, .plan-warning {
    margin-top: 10px; padding: 10px 14px; border-radius: var(--radius-md);
    font-size: 13px; line-height: 1.5;
  }
  .plan-notice { background: var(--gray-50); border: 1px solid var(--line); color: var(--muted); }
  .plan-warning { background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); color: #dc2626; }
  .plan-notice a, .plan-warning a { font-weight: 600; text-decoration: underline; }

  .sc-head-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .sc-head-row h2 { margin-bottom: 0; }

  .paid-badge {
    display: inline-flex; align-items: center;
    padding: 2px 8px; border-radius: 999px;
    font: 700 10px/1 "DM Mono", monospace; letter-spacing: 0.05em; text-transform: uppercase;
    background: rgba(232, 112, 154, 0.12); color: var(--accent); border: 1px solid rgba(232, 112, 154, 0.3);
  }

  .sc-locked { opacity: 0.75; }

  .upgrade-gate {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 16px; border-radius: var(--radius-md);
    border: 1px dashed var(--line); background: var(--gray-50);
    font-size: 13px; color: var(--muted);
  }
  .upgrade-gate a { font-weight: 600; color: var(--accent); white-space: nowrap; }

  .settings-grid { display: grid; gap: 16px; }

  .sc {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    padding: 24px;
  }

  .sc-head { margin-bottom: 18px; }
  .sc-head h2 { margin-bottom: 4px; }
  .sc-desc { font-size: 13px; margin-top: 2px; line-height: 1.55; color: var(--muted); }

  /* Provider status */
  .provider-status {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; border: 1px solid var(--line); border-radius: var(--radius-md);
    font-size: 13px; font-weight: 500; color: var(--muted); background: var(--gray-50);
  }
  .provider-status.connected { border-color: rgba(74, 222, 128, 0.2); color: var(--good); background: var(--good-light); }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--gray-400); flex: none; }
  .provider-status.connected .status-dot { background: var(--good); box-shadow: 0 0 8px rgba(74, 222, 128, 0.4); }
  .provider-actions { display: flex; gap: 10px; margin-top: 14px; }

  .manual-key {
    margin-top: 14px; padding: 18px; border: 1px solid var(--line);
    border-radius: var(--radius-lg); background: var(--gray-50); display: grid; gap: 12px;
  }

  /* Fields */
  .field { margin-top: 14px; }
  .field label { display: block; font: 600 12px/1 "DM Mono", monospace; color: var(--gray-600); margin-bottom: 6px; letter-spacing: 0.02em; }
  .field textarea, .field input, .field select {
    width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius-sm);
    background: var(--bg); color: var(--text); font: inherit; font-size: 13px; outline: none;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }
  .field textarea { resize: vertical; min-height: 68px; }
  .field textarea:focus, .field input:focus, .field select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--pink-glow); }
  .field select { appearance: auto; cursor: pointer; }
  .hint { display: block; font-size: 11px; color: var(--muted); margin-top: 5px; line-height: 1.5; }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .field-row .field { margin-top: 0; }

  /* Toggles */
  .toggle-row { display: flex; gap: 20px; margin-top: 16px; flex-wrap: wrap; }
  .toggle { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; user-select: none; }
  .toggle input[type="checkbox"] { position: absolute; opacity: 0; width: 0; height: 0; }
  .toggle-slider {
    width: 36px; height: 20px; border-radius: 10px; background: var(--gray-300);
    position: relative; transition: background 200ms ease; flex: none;
  }
  .toggle-slider::after {
    content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px;
    border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: transform 200ms ease;
  }
  .toggle input:checked + .toggle-slider { background: var(--accent); }
  .toggle input:checked + .toggle-slider::after { transform: translateX(16px); }
  .toggle-label { color: var(--gray-700); font-weight: 500; }

  /* Messages */
  .save-msg, .key-msg { font-size: 13px; font-weight: 500; margin-top: 8px; }
  .save-msg.good, .key-msg.good { color: var(--good); }
  .save-msg.bad, .key-msg.bad { color: var(--bad); }

  .bottom-actions { display: flex; align-items: center; gap: 14px; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--line); }

  /* Buy Me a Coffee */
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

  /* Topbar */
  .topbar-back {
    display: grid; place-items: center; width: 32px; height: 32px;
    border-radius: var(--radius-sm); color: var(--muted); transition: all 150ms ease;
  }
  .topbar-back:hover { background: rgba(255, 255, 255, 0.04); color: var(--text); }

  .topbar-btn {
    display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px;
    border-radius: var(--radius-md); font: 600 12px/1 "DM Mono", monospace;
    cursor: pointer; border: none; transition: all 160ms ease; font-family: inherit;
    background: linear-gradient(135deg, var(--pink-400), var(--pink-600)); color: #fff;
    box-shadow: 0 0 0 1px rgba(232, 112, 154, 0.3), 0 2px 12px rgba(232, 112, 154, 0.2);
  }
  .topbar-btn:hover { box-shadow: 0 0 0 1px rgba(232, 112, 154, 0.5), 0 4px 20px rgba(232, 112, 154, 0.3); transform: translateY(-1px); }
  .topbar-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  /* Sidebar user */
  .sidebar-user { display: flex; align-items: center; gap: 10px; padding: 8px; }
  .sidebar-user-avatar { width: 32px; height: 32px; border-radius: 50%; background: rgba(232, 112, 154, 0.15); color: var(--accent); display: grid; place-items: center; font: 700 13px/1 "DM Mono", monospace; flex: none; }
  .sidebar-user-info { display: flex; flex-direction: column; gap: 1px; }
  .sidebar-user-name { font-size: 13px; font-weight: 600; color: var(--gray-800); }
  .sidebar-user-role { font: 400 11px/1 "DM Mono", monospace; color: var(--muted); }
</style>
