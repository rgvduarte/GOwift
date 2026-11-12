# Landing page that reads as premium and tells the truth — design

Date: 2026-11-12 · Scope: `landing/` (the GitHub Pages site), no game changes

## Problem

The landing page scrolls sideways on most phones: the primary button reads
*Ride now on goindoor.onrender.com*, does not wrap, and is wider than a 320 to
390 px column. The hero image is upscaled three to four times on phones
(`sizes="100vw"` ignores the cover crop) and the headline sits on light sky at
about 2:1 contrast. Eight equal text cards, two small screenshots with
imperial units and a developer CTA in the hero bury the consumer path. Glass
cards sit on a flat ground, so they read as grey boxes. Nothing warns that the
free Render server sleeps and takes about a minute to wake. There is no
motion, a few polish defects (missing spaces in the footer credits, an
off-palette colour on the changelog) and no tests: the page is not part of
`make check`.

## Decision

- **Stay inside the GD design system:** near black `#0b0b0c` with grey glows,
  glass cards (white 9 % fill, 22 % border, 40 % top edge, blur), Helvetica
  Bold, monochrome, the GD monogram and the GO glyphs. The route colours
  (green road, red climbs, blue sprints) stay on the profile only, as in the app.
- **Order the page by what a visitor needs:** hero, *How it works* (three
  steps), a bento of real screenshots, a proof band, questions, *Host your
  own*, a last call. The hero's second button is *How it works*; hosting
  moves out of the hero.
- **Only real facts.** The proof band and the hero strip are computed at build
  time from `routes/*.json`, the same files the server loads, with the game's
  own definitions (one lap including the closing segment). No live rider
  count: the server sends no CORS headers, `players` counts humans only, and
  every request would wake the sleeping server (see ADR 0025). Screenshots are
  the existing ones (`landing/src/assets`, `docs/assets`); the metric ride
  screenshot replaces the imperial one, and the studio screenshot is cropped
  by CSS so its imperial HUD corner stays out of view. The hero file stays
  unchanged, as its CC BY-SA credit says.
- **Honest CTA:** *Start riding free*, with the host in a note under the
  buttons. Builds for a server that sleeps (`PUBLIC_APP_COLD_START`) say that
  the first start can take up to a minute, and an FAQ entry explains why.
- **Wake the server early, never in the way:** with `PUBLIC_APP_PREWARM`, a
  small script sends one `no-cors` request to the app's `/healthz` on every
  page view, once the page has loaded and the browser is idle (sooner if a
  *Ride* button is touched), and only if the visitor has not asked to save
  data. It never blocks, never
  retries and ignores every failure.
- **Hero quality:** source widths that exist (the file is 1,600 px), a `sizes`
  that accounts for the cover crop so phones get the largest file, a vertical
  scrim on phones and the image anchored above the text.
- **Tokens and glows:** spacing and type tokens in `global.css`, an eyebrow
  style, section padding instead of hairlines, and soft grey glows behind the
  glass clusters (no `background-attachment: fixed`, which iOS ignores and
  low-end Android repaints on scroll).
- **Motion in CSS only, and only with `prefers-reduced-motion:
  no-preference`:** the route profile draws itself once, sections rise in on
  scroll where scroll-driven animations exist, buttons give press feedback.
- **Polish:** footer spacing, FAQ markers silent for screen readers, the code
  block's copy button, JSON-LD (`WebApplication`, free, no ratings), image
  placeholders, an inline SVG monogram instead of a PNG, a downsampled
  profile that keeps its peaks.

## Validation

`landing/test/*.test.mjs`, plain `node --test` with no new dependencies:

- unit tests for the pure helpers in `landing/src/lib/` (CTA label, wake-up
  URL and once-only wake-up with injected `fetch` and connection, route
  stats and profile with an injected routes directory, profile downsampling);
- build tests over `dist/` (skipped without a build): links stay under the
  base path, motion sits behind the reduced-motion query, no fixed
  backgrounds, the proof band shows the route stats, the footer credit reads
  with its spaces, JSON-LD claims no ratings.

`make test-landing` builds the page and runs them; `make test` and CI include
it. Ad hoc, Playwright screenshots at 1440×900 and 390×844 (full page), a
check that `scrollWidth <= innerWidth` at 320, 360, 390 and 414 px, and a
look at the reduced-motion variant.
