<script>
  import "../app.css";
  let { children } = $props();
</script>

<svelte:head>
  <title>slopblock</title>
</svelte:head>

{@render children()}
