// Links and names used across the landing page. Build-time environment
// variables override them (see landing/README.md), so a self-hoster can build
// the page for their own domains.

import { appHostOf } from "./lib/app";

const env = import.meta.env;

const githubUrl = "https://github.com/rgvduarte/GOwift";

export const site = {
  name: "GOindoor",
  // The page's public address. Its path is also the base path every link is
  // built on, e.g. /GOwift/ on GitHub Pages (see astro.config.mjs).
  url: env.PUBLIC_SITE_URL || "https://rgvduarte.github.io/GOwift",
  // The game server riders open. Empty while there is no public server: the
  // *Ride now* buttons then lead to the self-hosting quick start.
  appUrl: env.PUBLIC_APP_URL || "",
  githubUrl,
  owner: "GD",
  ownerUrl: "https://github.com/rgvduarte",
  upstreamUrl: "https://github.com/Lethonium/OpenRadlr",
  discordUrl: env.PUBLIC_DISCORD_URL || "",
  // The operator's privacy policy and imprint (legal notice), linked in the
  // footer. E.g. a page generated with online-impressum.de; empty = no link,
  // so every self-hoster provides their own.
  privacyUrl: env.PUBLIC_PRIVACY_URL || "",
  imprintUrl: env.PUBLIC_IMPRINT_URL || "",
  // Cookie-free Plausible, as in the app. Unset = no analytics script at all.
  plausibleDomain: env.PUBLIC_PLAUSIBLE_DOMAIN || "",
  plausibleScript: env.PUBLIC_PLAUSIBLE_SCRIPT || "https://plausible.io/js/script.js",
  description:
    "Free, open-source indoor cycling in the browser. Connect your smart trainer and ride an island world together with friends and bots.",
};

/** Whether a public game server is configured. */
export const hasApp = site.appUrl !== "";

/** Where the *Ride now* buttons go: the server, or the self-hosting quick start. */
export const rideUrl = hasApp ? site.appUrl : `${githubUrl}#quick-start`;

/** The app's address without the scheme, for captions. */
export const appHost = hasApp ? appHostOf(site.appUrl) : "your own server";

/** A path inside the site, under the base path (e.g. "icons/x.png" → "/GOwift/icons/x.png"). */
export function href(path = ""): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  return base + path.replace(/^\//, "");
}
