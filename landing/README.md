# GOindoor landing page

The public page for GOindoor (on GitHub Pages: https://rgvduarte.github.io/GOwift): a static [Astro](https://astro.build) site
that explains GOindoor and links to the app (`PUBLIC_APP_URL`). It is
separate from `client/`, which stays dependency-free.

- `src/pages/index.astro`: the page itself; the privacy policy and imprint are
  operator-provided links (`PUBLIC_PRIVACY_URL`, `PUBLIC_IMPRINT_URL`).
- `src/pages/changelog.astro` renders the repository's `CHANGELOG.md`.
- The hero's elevation profile is drawn at build time from
  `routes/col-de-la-forge.json`, so it always matches the game.
- Colours and fonts follow the app (`client/public/styles.css`).
- Screenshots in `src/assets/` come from the real game; Astro turns them into
  AVIF/WebP in several sizes.

## Build and run

With Docker only (as on the server), from the repository root:

```bash
COMPOSE_PROFILES=landing docker compose up -d --build landing   # http://localhost:8081
```

With Node 22.12+ installed, in `landing/`:

```bash
npm ci
npm run dev       # http://localhost:4321, reloads on save
npm run build     # static files in dist/
```

## Settings (build time)

| Variable | Default | Used for |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | `https://rgvduarte.github.io/GOwift` | canonical links, sitemap, Open Graph; its path is the base path of every link |
| `PUBLIC_APP_URL` | – | every *Ride now* button; without it they lead to the self-hosting quick start |
| `PUBLIC_DISCORD_URL` | – | Discord link; without it the page points to GitHub issues |
| `PUBLIC_PRIVACY_URL` | – | privacy policy link in the footer (the app's `GOINDOOR_PRIVACY_URL`); without it no link is shown |
| `PUBLIC_IMPRINT_URL` | – | imprint (legal notice) link in the footer, e.g. a page from online-impressum.de; without it no link is shown |
| `PUBLIC_PLAUSIBLE_DOMAIN` | – | cookie-free Plausible analytics; without it no script is loaded |
| `PUBLIC_PLAUSIBLE_SCRIPT` | Plausible Cloud (`https://plausible.io/js/script.js`) | script URL, e.g. your own instance |

Docker Compose fills them from `.env` (`GOINDOOR_LANDING_URL`,
`GOINDOOR_PUBLIC_URL`, `GOINDOOR_DISCORD_URL`, `GOINDOOR_PRIVACY_URL`,
`GOINDOOR_LANDING_IMPRINT_URL`,
`GOINDOOR_LANDING_PLAUSIBLE_DOMAIN`, and `PUBLIC_PLAUSIBLE_SCRIPT` from
`GOINDOOR_ANALYTICS_SCRIPT`, the same script the app uses). Deployment: [docs/deploy.md](../docs/deploy.md#landing-page).

## GitHub Pages

`.github/workflows/pages.yml` builds this page on every push to `main` that
touches it and publishes it at <https://rgvduarte.github.io/GOwift/>. Turn it
on once under *Settings → Pages → Source: GitHub Actions*. The workflow takes
`PUBLIC_SITE_URL` from Pages itself and `PUBLIC_APP_URL` from the repository
variable `GOINDOOR_PUBLIC_URL`, or the public server on Render
(`https://goindoor.onrender.com`) when it is unset.
