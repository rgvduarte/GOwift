# 28. The landing page shows build-time facts and wakes the server with a no-cors request

Date: 2026-11-12 · Status: accepted

## Context

The landing page (`landing/`, on GitHub Pages) is static. Its *Ride* buttons
open the public game server on Render's free plan, which sleeps after 15
minutes without riders and takes about a minute to wake (docs/deploy.md). A
first-time visitor who clicks sees Render's loading screen for a minute and
may leave, without having been told why.

A page that feels alive would show live numbers, such as riders online. That
is not possible today and would mislead if it were:

- The server sends no CORS headers (`tower-http` without the `cors` feature,
  no `Access-Control-Allow-Origin` in `headers.rs`), so a page on another
  origin cannot read `/api/info`.
- `players` counts human connections only. On a free server with a handful of
  riders it would usually read 0, which is anti-social proof.
- Every visit would wake the sleeping server, and Render's distance totals
  reset because the free plan has no disk.

## Decision

- **Facts come from the repository at build time.** The page's numbers (how
  many routes, how far and how much climbing one lap of each adds up to, the
  longest ride) are computed by `landing/src/lib/route.ts` from
  `routes/*.json`, the files the server loads, with the game's definitions:
  one lap including the closing segment, climbing as the sum of rises. The
  Pages workflow already rebuilds when `routes/**` changes, so the numbers
  follow the game. No live counters.
- **Say that the first start can take a minute** where it applies:
  `PUBLIC_APP_COLD_START=true` adds a note under the buttons and an FAQ entry.
- **Wake the server early with a request the page never reads.** With
  `PUBLIC_APP_PREWARM=true`, a small script sends one
  `fetch(appUrl + "/healthz", { mode: "no-cors" })` on every page view, once
  the page has loaded and the browser is idle, or sooner when a visitor points
  at, focuses or touches a *Ride* link. Waiting for a *Ride* link to come into
  view would change nothing: the header's *Ride now* is on every page and on
  screen at load. An opaque response is enough to start the instance, so the
  server needs no CORS change. The request sends no cookies and no referrer,
  is skipped when the visitor's browser asks to save data, happens at most
  once per page view, and every failure is ignored: the page never waits for
  it or breaks because of it.
- The Pages workflow turns the note on for the public Render server; a
  repository variable turns it off. Pre-warming stays off there until the
  operator turns it on with a repository variable, once the privacy policy
  the footer links (another repository variable) says so. Self-hosted builds
  (Docker Compose) leave both off.

## Consequences

- No server or protocol change; the game stays the only reader of its API.
- Most of the wake-up happens while the visitor reads, so the click lands on a
  server that is starting or already up.
- With pre-warming on, every visitor's IP address reaches the game server's
  host before they click, and crawlers that run scripts wake it too. The
  operator's privacy policy should say so; the flag is off by default.
- An awake server uses Render's free instance hours. One always-on service
  fits the 750 hours a month, but other free services in the same Render
  workspace share them.
- Live numbers (riders online, the next spin class from the server) stay
  possible later, behind an explicit, read-only CORS allowance for
  aggregates; until then the page states only what the repository proves.
