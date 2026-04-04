<script lang="ts">
  interface Option {
    value: string;
    label: string;
    detail?: string;
  }

  let {
    options,
    value = $bindable(""),
    placeholder = "Search...",
    id = "",
    emptyLabel = "Default"
  }: {
    options: Option[];
    value: string;
    placeholder?: string;
    id?: string;
    emptyLabel?: string;
  } = $props();

  let query = $state("");
  let open = $state(false);
  let focusedIndex = $state(-1);
  let inputEl: HTMLInputElement | undefined = $state();
  let listEl: HTMLDivElement | undefined = $state();

  const selectedLabel = $derived(
    value ? (options.find((o) => o.value === value)?.label ?? value) : ""
  );

  const filtered = $derived(
    query
      ? options.filter(
          (o) =>
            o.value.toLowerCase().includes(query.toLowerCase()) ||
            o.label.toLowerCase().includes(query.toLowerCase())
        )
      : options
  );

  function select(opt: Option | null) {
    value = opt?.value ?? "";
    query = "";
    open = false;
    focusedIndex = -1;
  }

  function onFocus() {
    open = true;
    query = "";
    focusedIndex = -1;
  }

  function onBlur() {
    // Delay to allow click on option
    setTimeout(() => { open = false; query = ""; }, 150);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, filtered.length - 1);
      scrollToFocused();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, -1);
      scrollToFocused();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex >= 0 && filtered[focusedIndex]) {
        select(filtered[focusedIndex]);
      }
    } else if (e.key === "Escape") {
      open = false;
      query = "";
      inputEl?.blur();
    }
  }

  function scrollToFocused() {
    if (listEl && focusedIndex >= 0) {
      const el = listEl.children[focusedIndex + 1] as HTMLElement; // +1 for the "default" option
      el?.scrollIntoView({ block: "nearest" });
    }
  }
</script>

<div class="search-select" {id}>
  <div class="input-wrapper">
    <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input
      bind:this={inputEl}
      type="text"
      class="search-input"
      value={open ? query : selectedLabel}
      oninput={(e) => { query = e.currentTarget.value; focusedIndex = -1; }}
      onfocus={onFocus}
      onblur={onBlur}
      onkeydown={onKeydown}
      {placeholder}
      autocomplete="off"
    />
    {#if value}
      <button type="button" class="clear-btn" onmousedown={(e) => { e.preventDefault(); select(null); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    {/if}
  </div>
  {#if open}
    <div class="dropdown" bind:this={listEl}>
      <button
        type="button"
        class="option"
        class:focused={focusedIndex === -1}
        onmousedown={(e) => { e.preventDefault(); select(null); }}
      >
        <span class="option-label">{emptyLabel}</span>
      </button>
      {#each filtered as opt, i}
        <button
          type="button"
          class="option"
          class:focused={i === focusedIndex}
          class:selected={opt.value === value}
          onmousedown={(e) => { e.preventDefault(); select(opt); }}
        >
          <span class="option-label">{opt.label}</span>
          {#if opt.detail}
            <span class="option-detail">{opt.detail}</span>
          {/if}
        </button>
      {/each}
      {#if filtered.length === 0}
        <div class="no-results">No models found</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .search-select {
    position: relative;
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    color: var(--gray-400);
    pointer-events: none;
    flex: none;
  }

  .search-input {
    width: 100%;
    padding: 10px 14px 10px 36px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 14px;
    outline: none;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }

  .search-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(212, 80, 126, 0.1);
  }

  .clear-btn {
    position: absolute;
    right: 8px;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--gray-400);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 150ms ease;
  }

  .clear-btn:hover {
    background: var(--gray-100);
    color: var(--gray-600);
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    max-height: 280px;
    overflow-y: auto;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    z-index: 50;
    box-shadow: var(--shadow-lg);
  }

  .option {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    padding: 9px 14px;
    border: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: background 80ms ease;
  }

  .option:hover,
  .option.focused {
    background: var(--pink-50);
  }

  .option.selected {
    color: var(--accent);
    font-weight: 600;
  }

  .option-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .option-detail {
    font-size: 11px;
    color: var(--muted);
    flex: none;
  }

  .no-results {
    padding: 16px 14px;
    font-size: 13px;
    color: var(--muted);
    text-align: center;
  }

  .dropdown::-webkit-scrollbar {
    width: 6px;
  }

  .dropdown::-webkit-scrollbar-track {
    background: transparent;
  }

  .dropdown::-webkit-scrollbar-thumb {
    background: var(--gray-200);
    border-radius: 3px;
  }

  .dropdown::-webkit-scrollbar-thumb:hover {
    background: var(--gray-300);
  }
</style>
