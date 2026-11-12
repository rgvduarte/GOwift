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
