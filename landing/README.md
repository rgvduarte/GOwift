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
- Screenshots in `src/assets/` and the repository's `docs/assets/` come from
  the real game; Astro turns them into AVIF/WebP in several sizes.
- The numbers on the page (routes, kilometres, climbing, the longest ride)
  are counted from `routes/*.json` at build time (`src/lib/route.ts`), with the
  game's definition of a lap, so they always match the server.

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
npm test          # unit tests, plus checks on dist/ if it exists
```

`make test-landing` (part of `make test` and `make check`) builds the page and
runs the tests. They are plain `node --test` files in `test/`: the helpers in
`src/lib/` take their inputs (the routes directory, `fetch`) as arguments, and
`test/build.test.mjs` checks the built site, e.g. that every link stays under
the base path.

## Settings (build time)

| Variable | Default | Used for |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | `https://rgvduarte.github.io/GOwift` | canonical links, sitemap, Open Graph; its path is the base path of every link |
| `PUBLIC_APP_URL` | – | every *Ride now* button; without it they lead to the self-hosting quick start |
| `PUBLIC_APP_COLD_START` | – | `true` for a server that sleeps while nobody rides (Render's free plan): the buttons and the FAQ say the first start can take a minute |
| `PUBLIC_APP_PREWARM` | – | `true` sends one request to the server's `/healthz` on every page view, once the page has loaded, so a sleeping server is awake by the click ([ADR 0028](../docs/adr/0028-landing-facts-and-wake-up.md)); it reveals the visitor's IP address to the server's host, so mention it in your privacy policy |
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
(`https://goindoor.onrender.com`) when it is unset. That server is on the free
plan, so the workflow also sets `PUBLIC_APP_COLD_START`; the repository
variable `GOINDOOR_LANDING_COLD_START` set to `false` turns it off, e.g. for a
server that is always on. Pre-warming stays off until the repository variable
`GOINDOOR_LANDING_PREWARM` is `true`: it shows every visitor's IP address to
the server's host, so first link a privacy policy that says so. The footer's
links come from the repository variables `GOINDOOR_PRIVACY_URL` and
`GOINDOOR_LANDING_IMPRINT_URL`, as in Docker Compose.
