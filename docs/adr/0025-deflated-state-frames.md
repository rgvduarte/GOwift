# 25. State frames are raw-deflated on one stream per connection

Date: 2026-11-12 · Status: accepted

## Context

State goes to every rider as JSON at 4 Hz ([ADR 2](0002-authoritative-server-json-websocket.md)).
Measured with the release server, all bundled routes and one rider on the
simulated trainer in headless Chromium (bytes the server sent, over 60 s):

| Settings | JSON text frames |
| --- | --- |
| Defaults (`GOINDOOR_TARGET_RIDERS=12`, `GOINDOOR_MAX_VISIBLE_RIDERS=200`) | 91 KB/s, 327 MB an hour |
| `render.yaml` (6 and 15) | 16.6 KB/s, 60 MB an hour |

Render's free plan allows 5 GB of traffic a month, so the free server lasted
about 85 riding hours. Numbers were already rounded; the bytes are keys,
names, route and road ids and bot kits, sent again in every state.

Two ways were measured on recorded state frames:

1. **permessage-deflate** (RFC 7692), which browsers negotiate on their own.
   The server's WebSocket stack (axum 0.8 on tungstenite 0.29; 0.30 is the
   latest) does not implement it, and tungstenite rejects frames with the RSV1
   bit a compressing browser would send. Getting it means replacing the frame
   parser of an internet-facing server with a younger crate.
2. **A leaner encoding**: static fields (name, kit, route) only when a rider
   comes into view, short keys, no `lap: null`. It halves the JSON but breaks
   the protocol, and once frames are deflated it saves only another 8–12 %.

Deflate with the window kept across messages is what pays: everything that
repeats from the last state costs a few bytes. Average state frame, defaults /
`render.yaml`, flate2 at level 3:

| Format | JSON | Deflate, fresh per message | Deflate, one stream |
| --- | --- | --- | --- |
| Current | 22.6 KB / 4.1 KB | 3.7 KB / 1.0 KB | 1.9 KB / 0.30 KB |
| Leaner | 10.6 KB / 2.0 KB | 2.3 KB / 0.57 KB | 1.7 KB / 0.28 KB |

## Decision

- **Deflate in the application, on the existing WebSocket.** `hello` offers
  `compression: ["deflate-raw"]`; a `welcome` with `compression: "deflate-raw"`
  is the last text frame. Every later server message is a binary frame: its JSON
  and a newline, raw-deflated on one stream for the whole connection and
  sync-flushed (`frames.rs`). The browser feeds the frames in order through one
  `DecompressionStream("deflate-raw")` and splits messages at newlines
  (`net/inflate.js`). Client messages stay JSON text: telemetry is small.
- **Opt-in, so the protocol version stays 2.** A client that offers nothing,
  an older client or a browser without `DecompressionStream("deflate-raw")`
  (before Chrome 103, Firefox 113, Safari 16.4) gets text frames; a new client
  on an older server gets text frames too.
- **Level 3.** On recorded state it sends a twelfth of the JSON at half the CPU
  of level 6 (a fourteenth); level 1 sends a sixth to an eighth.
- **Keep the JSON format.** The leaner encoding isn't worth a protocol break for
  8–12 %.

## Consequences

- One rider receives 7.8 KB/s (28 MB an hour) with the defaults and 1.5 KB/s
  (5.3 MB an hour) with `render.yaml`, about 11.5 times less.
- Each rider costs the server about 240 KB more memory (the deflate window and
  hash tables) and about 0.02 % of a CPU core (20 riders: 2.3 → 2.7 %).
- Browser dev tools show state as binary frames. A client that doesn't offer
  compression (websocat, the end-to-end tests) still reads JSON.
- A frame can only be decoded after the frames before it: they are decoded in
  order, and a close waits until the frames before it are delivered, so a final
  `error` still explains it.
- After compression, TCP, TLS and WebSocket headers are a noticeable part of
  each frame; the broadcast rate (`GOINDOOR_BROADCAST_HZ`) is the next lever,
  not the encoding.
