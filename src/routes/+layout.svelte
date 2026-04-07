<script>
  import "../app.css";
  import { page } from "$app/state";
  import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "$lib/constants";

  let { children } = $props();

  let canonicalUrl = $derived(`${SITE_URL}${page.url.pathname === "/" ? "" : page.url.pathname}`);
  let defaultTitle = `${SITE_NAME} — Know the Code Before It Ships`;
  let ogImage = `${SITE_URL}/og-image.png`;

  const websiteJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
  });

  const orgJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/web-app-manifest-512x512.png`,
    sameAs: ["https://github.com/sampnorris/slopblock"],
  });
</script>

<svelte:head>
  <title>{defaultTitle}</title>
  <meta name="description" content={SITE_DESCRIPTION} />
  <link rel="canonical" href={canonicalUrl} />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:title" content={defaultTitle} />
  <meta property="og:description" content={SITE_DESCRIPTION} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={defaultTitle} />
  <meta name="twitter:description" content={SITE_DESCRIPTION} />
  <meta name="twitter:image" content={ogImage} />

  <!-- Structured Data -->
  {@html `<script type="application/ld+json">${websiteJsonLd}</script>`}
  {@html `<script type="application/ld+json">${orgJsonLd}</script>`}
</svelte:head>

{@render children()}
