import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// PUBLIC_SITE_URL is the page's public address. Its path becomes the base
// path, so the same build works at a domain's root (https://example.org) and
// under a project path such as GitHub Pages (https://rgvduarte.github.io/GOwift).
const siteUrl = new URL(process.env.PUBLIC_SITE_URL || "https://rgvduarte.github.io/GOwift");

export default defineConfig({
  site: siteUrl.origin,
  base: siteUrl.pathname,
  output: "static",
  trailingSlash: "ignore",
  integrations: [sitemap({ filter: (page) => !page.endsWith("/404/") })],
});
