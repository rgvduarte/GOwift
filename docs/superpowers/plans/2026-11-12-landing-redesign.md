# Landing page redesign — implementation plan

Spec: `docs/superpowers/specs/2026-11-12-landing-redesign-design.md`
Branch: `impl/landing`.

1. Add the test harness: `npm test` in `landing/`, `make test-landing` (build,
   then test) in `make test`, a landing job in CI and a test step in
   `pages.yml`. First tests: the route profile with an injected routes
   directory, and links under the base path in the build.
2. Failing test for the CTA label, then *Start riding free*, the host note and
   buttons that wrap, so phones stop scrolling sideways.
3. Failing tests for the wake-up URL and the once-only wake-up, then the
   cold-start note, the FAQ entry and the `no-cors` ping behind
   `PUBLIC_APP_COLD_START` / `PUBLIC_APP_PREWARM`; docs and ADR 0025.
4. Failing build test for fixed backgrounds, then the spacing, type and glow
   tokens.
5. Failing tests for the route stats, then the new page order, the bento of
   screenshots and the proof band.
6. Hero: real source widths, a `sizes` for the cover crop, the phone scrim
   and layout; a build test for the candidates.
7. Failing build test for motion outside the reduced-motion query, then the
   profile draw, scroll reveals and button feedback.
8. Polish with tests where they apply: footer spacing, FAQ markers, code copy
   button, JSON-LD, the changelog colour, placeholders, the inline monogram,
   profile downsampling.
9. Build, serve under `/GOwift/`, screenshot 1440×900 and 390×844, check
   horizontal scroll at 320–414 px, iterate; `make test-landing`.

## Result

Implemented on `impl/landing`, one commit for each of steps 1–8. `landing/test`
has 54 tests (unit tests for `src/lib/` and checks on `dist/`); `make
test-landing` builds the page and runs them, and `make test`, the CI landing
job and the Pages workflow include it. `make check` passes: lint, 585 Rust
tests, 1,313 client tests and the 54 landing tests (on the default build,
without a public server; the Pages build passes them too).

Browser checks against the Pages build (`PUBLIC_APP_URL` on Render, cold
start and pre-warm on), served under `/GOwift/` with headless Chromium:

- `scrollWidth == innerWidth` at 320, 360, 390, 414 and 1440 px, and no
  element wider than its box or the screen (the code block scrolls inside
  its column).
- Hero: phones get the 1,200 or 1,600 px file instead of 800 px; the
  headline and the at-a-glance glass measure 4.2:1 or better on desktop and
  about 19:1 on phones.
- Exactly one request to `https://goindoor.onrender.com/healthz` per page
  view; with no network the page still renders and logs nothing but the
  browser's failed-resource line.
- With `reducedMotion: "reduce"` the profile and the sections do not
  animate; with motion, sections reveal on scroll (the animation longhands
  matter: Chromium drops a shorthand that contains `view()`).
- The Copy button copies with clipboard permission and selects the commands
  without it; the changelog and 404 pages share the new tokens and glows.

Not done: new captures of the game (the hero is still the 1,600 px OpenRadlr
image, and the studio screenshot still shows miles, hidden by its crop), and
the live spin-class countdown, which was not part of this change.
