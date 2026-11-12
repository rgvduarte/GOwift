# 25. Drafting depends on the place in a group, and only the server knows it

Date: 2026-11-12 · Status: accepted

## Context

Every follower got at most 30 % less drag from the single nearest rider ahead
in its lane, whether it sat second wheel or twentieth in a bunch. So a group was
no faster than a pair, and sitting in a bunch felt like sitting on one wheel.
Measured shelter grows with depth and with riders around: the second of two
riders has up to 27.1 % less drag and the first up to 2.6 % less (Blocken et
al. 2013, *Comput. Fluids* 71:435–445); a team pursuit line saves 45, 55 and
57 % on positions 2–4 (Barry et al. 2015, *Sports Eng.* 18:93–103); deep in a
121-rider peloton drag drops to 5–10 % of a solo rider's (Blocken et al. 2018,
*J. Wind Eng. Ind. Aerodyn.* 179:319–337).

The client's virtual shifting and its "drafting %" came from a copy of the
one-wheel rule (`ride/draft.js`). That copy already disagreed with the server:
it missed drafts across routes on a shared road and behind a beer bike, and it
drafted behind parked riders and other apps' riders. A group rule would widen
the gap.

## Decision

- **Shelter by place in the group** (`DraftParams::group_factor`, fed once per
  tick by `Field::shelter`):
  - the first, second, third and fourth-and-later wheel of a same-lane line
    (every link inside the 2–6.5 m window) save up to 30, 40, 45 and 48 %;
  - each rider up to 4 m ahead in a neighbouring lane (at most 1.5 lanes off)
    adds 4 %, for a rider on a wheel;
  - a bunch saves at most 60 %;
  - a rider with a wheel 2 m behind saves 2.6 %, fading to nothing at 4 m.
  The window and its linear fade stay as they were, so bots' draft window and
  the spacing logic need no change, and a pair rides exactly as before. Behind
  a beer bike every wheel keeps at least its 50 %.
- **The server sends the result.** `state.drag_factor` is everything the
  physics scaled the rider's air drag by in the last tick, `state.draft` the
  drafting part alone. Virtual shifting pushes with `drag_factor`, the HUD shows
  `draft`. The client's copy of the rule stays only for older servers, which
  send neither, and to draw the gap to the wheel ahead on the map.

## Consequences

- The game stays well below the measured peloton values: its riders hold a
  perfect line, and no crosswind gaps anyone. Raising the cap is a tuning step.
- Big groups ride faster and breakaways get harder; race times and route
  records move. Bots aim for the same window, but a deeper draft gives them more
  surplus, so the pass logic rotates them through a line a little more often.
- A leader with a wheel behind slightly out-accelerates the clear-air
  comparison of the pass logic: at equal power, followers pass a little less.
- The depth walk stops after four links, which also ends it round a ring of
  riders on a short loop. The per-tick cost stays one scan of the field per
  rider, as before.
- The HUD now shows what the server applies: 0 % behind another app's rider,
  50 % behind a beer bike, a few percent for a leader with a wheel behind.
- Only the viewer's own numbers are sent; other riders' drafts stay on the
  server.
