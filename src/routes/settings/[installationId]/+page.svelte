<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const installationId = data.installationId;
  const actor = data.actor;

  let saving = $state(false);
  let saveMessage = $state("");
  let saveOk = $state(false);

  let llmApiKey = $state(data.settings?.llmApiKey ?? "");
  let llmBaseUrl = $state(data.settings?.llmBaseUrl ?? "");
  let llmGenerationModel = $state(data.settings?.llmGenerationModel ?? "");
  let llmValidationModel = $state(data.settings?.llmValidationModel ?? "");
  let llmSkipModel = $state(data.settings?.llmSkipModel ?? "");
  let questionCountMin = $state(data.settings?.questionCountMin ?? 2);
  let questionCountMax = $state(data.settings?.questionCountMax ?? 5);
  let retryMode = $state(data.settings?.retryMode ?? "new_quiz");
  let skipBots = $state(data.settings?.skipBots ?? true);
  let skipForks = $state(data.settings?.skipForks ?? true);

  const providers = [
    { label: "Vercel AI Gateway (default)", baseUrl: "", hint: "Uses AI_GATEWAY_API_KEY env var" },
    { label: "OpenAI", baseUrl: "https://api.openai.com/v1", hint: "Use your OpenAI API key" },
    { label: "Anthropic", baseUrl: "https://api.anthropic.com/v1", hint: "Use your Anthropic API key" },
    { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", hint: "Use your OpenRouter API key" },
    { label: "GitHub Models", baseUrl: "https://models.inference.ai.azure.com/v1", hint: "Use a GitHub PAT with models:read scope. Free tier has low rate limits." },
    { label: "Custom", baseUrl: "custom", hint: "Any OpenAI-compatible endpoint" },
  ];

  let selectedProvider = $state(
    providers.find(p => p.baseUrl === llmBaseUrl)?.label ??
    (llmBaseUrl ? "Custom" : "Vercel AI Gateway (default)")
  );

  function onProviderChange(label: string) {
    selectedProvider = label;
    const p = providers.find(pr => pr.label === label);
    if (p && p.baseUrl !== "custom") {
      llmBaseUrl = p.baseUrl;
    }
  }

  const models = [
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-opus-4.1",
    "anthropic/claude-haiku-3.5",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "google/gemini-2.0-flash",
  ];

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
          llmApiKey,
          llmBaseUrl,
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
        if (json.settings?.llmApiKey) {
          llmApiKey = json.settings.llmApiKey;
        }
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
    <!-- LLM Provider -->
    <section class="section">
      <h2>LLM Provider</h2>
      <div class="field">
        <label for="provider">Provider</label>
        <select id="provider" value={selectedProvider} onchange={(e) => onProviderChange(e.currentTarget.value)}>
          {#each providers as p}
            <option value={p.label}>{p.label}</option>
          {/each}
        </select>
        <span class="hint">{providers.find(p => p.label === selectedProvider)?.hint ?? ""}</span>
      </div>

      {#if selectedProvider === "Custom"}
        <div class="field">
          <label for="baseUrl">Base URL</label>
          <input id="baseUrl" type="url" bind:value={llmBaseUrl} placeholder="https://your-provider.com/v1" />
        </div>
      {/if}

      <div class="field">
        <label for="apiKey">API Key</label>
        <input id="apiKey" type="password" bind:value={llmApiKey} placeholder="Leave blank to use env var" />
        <span class="hint">Stored encrypted. Leave blank to use the AI_GATEWAY_API_KEY environment variable.</span>
      </div>
    </section>

    <!-- Models -->
    <section class="section">
      <h2>Models</h2>
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
        {#each models as m}
          <option value={m}></option>
        {/each}
      </datalist>
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

  .save-msg {
    font-size: 14px;
    font-weight: 500;
  }

  .save-msg.good { color: var(--good); }
  .save-msg.bad { color: var(--bad); }
</style>
