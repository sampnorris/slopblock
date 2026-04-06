<script lang="ts">
  import { CONTACT_EMAIL, GITHUB_ISSUES_URL } from "$lib/constants";

  let name = $state("");
  let email = $state("");
  let subject = $state("");
  let message = $state("");
  let submitted = $state(false);

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    // TODO: hook up to backend
    submitted = true;
  }
</script>

<svelte:head>
  <title>Contact — SlopBlock</title>
  <meta name="description" content="Get in touch with the SlopBlock team." />
</svelte:head>

<h1>Contact Us</h1>
<p class="subtitle">
  Have a question, bug report, or feature request? Drop us a message and we'll
  get back to you.
</p>

{#if submitted}
  <div class="confirmation">
    <span class="confirmation-icon">&#10003;</span>
    <h2>Message received</h2>
    <p>
      Thanks for reaching out! We'll get back to you at <strong>{email}</strong> as
      soon as we can.
    </p>
    <button class="button" onclick={() => (submitted = false)}>
      Send another message
    </button>
  </div>
{:else}
  <form class="contact-form" onsubmit={handleSubmit}>
    <div class="field-row">
      <label class="field">
        <span class="label">Name</span>
        <input
          type="text"
          bind:value={name}
          placeholder="Ada Lovelace"
          required
        />
      </label>

      <label class="field">
        <span class="label">Email</span>
        <input
          type="email"
          bind:value={email}
          placeholder="ada@example.com"
          required
        />
      </label>
    </div>

    <label class="field">
      <span class="label">Subject</span>
      <input
        type="text"
        bind:value={subject}
        placeholder="What's this about?"
        required
      />
    </label>

    <label class="field">
      <span class="label">Message</span>
      <textarea
        bind:value={message}
        placeholder="Tell us more..."
        rows="6"
        required
      ></textarea>
    </label>

    <button type="submit" class="button primary">Send Message</button>
  </form>

  <div class="alt-contact">
    <p>
      You can also open an issue on
      <a
        href={GITHUB_ISSUES_URL}
        target="_blank"
        rel="noreferrer">GitHub</a
      >
      or email us at
      <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a>.
    </p>
  </div>
{/if}

<style>
  .subtitle {
    margin: 8px 0 32px;
    font-size: 15px;
    line-height: 1.7;
    color: var(--muted);
  }

  /* ── Form ──────────────────────────────────── */

  .contact-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  @media (max-width: 540px) {
    .field-row {
      grid-template-columns: 1fr;
    }
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    font: 500 13px/1 "DM Sans", sans-serif;
    color: var(--gray-700);
    letter-spacing: -0.01em;
  }

  input,
  textarea {
    width: 100%;
    padding: 11px 14px;
    background: var(--gray-50);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    color: var(--text);
    font: 400 14px/1.5 "DM Sans", sans-serif;
    transition: border-color 160ms ease, box-shadow 160ms ease;
    resize: vertical;
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--gray-400);
  }

  input:focus,
  textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--pink-glow);
  }

  textarea {
    min-height: 120px;
  }

  /* ── Confirmation ──────────────────────────── */

  .confirmation {
    text-align: center;
    padding: 48px 16px;
  }

  .confirmation-icon {
    display: inline-grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--good-light);
    color: var(--good);
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 20px;
    border: 1px solid rgba(74, 222, 128, 0.2);
  }

  .confirmation h2 {
    margin: 0 0 8px;
    font: 600 20px/1.3 "DM Sans", sans-serif;
    color: #fff;
  }

  .confirmation p {
    margin: 0 0 28px;
    color: var(--muted);
    font-size: 15px;
    line-height: 1.7;
  }

  .confirmation .button {
    width: auto;
    display: inline-flex;
  }

  /* ── Alternate contact ─────────────────────── */

  .alt-contact {
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid var(--line);
  }

  .alt-contact p {
    font-size: 14px;
    color: var(--muted);
    line-height: 1.7;
  }
</style>
