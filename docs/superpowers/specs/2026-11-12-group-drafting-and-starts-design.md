# Group drafting, standing starts and thin air — design

Date: 2026-11-12 · Status: implemented

## Goal

Riding in a group should feel like riding in a group, and the pedals should feel
the drag the server's physics applies. Today:

- Every follower gets at most 30 % less drag, whether it is second wheel or
  twentieth in a bunch, and a group is no faster than a pair.
- Virtual shifting and the HUD's "drafting %" come from a client-side mirror of
  the draft rule. It already differs from the server in five ways: drafting
  across routes on a shared road, the beer bike's stronger and wider draft,
  parked riders, other apps' riders (who never draft) and 4 Hz positions.
- A standing start (every race starts from 0) pushes 85 kg at up to 1.2 g, and
  more at a low tick rate, because `P / max(v, 1 m/s)` has no grip limit.
- Air density is the sea-level 1.225 kg/m³ everywhere.

## Decisions

| Question | Decision |
| --- | --- |
| Who computes the draft | The server, and only the server. `state` carries the viewer's `drag_factor` (everything the physics scaled ½·ρ·CdA·v² by) and `draft` (drafting alone, for display). The client mirror stays as the fallback for older servers |
| Depth in a line | Reduction 30 / 40 / 45 / 48 % on the 1st / 2nd / 3rd / 4th-and-later wheel of a same-lane line whose every link is inside the draft window |
| Riders alongside | +4 % per rider up to 4 m ahead in a neighbouring lane (≤ 1.5 lanes off), only for a rider on a wheel |
| Bunch cap | 60 % (Blocken et al. 2018 measured 90–95 % deep in a peloton; game riders hold perfect position and nobody is gapped by crosswind) |
| Leader | 2.6 % less drag with a wheel 2 m behind, fading to none at 4 m (Blocken et al. 2013) |
| Draft window | Unchanged (2–6.5 m, linear fade): bots' `draft_window` and the spacing logic stay valid |
| Beer bike | Its 50 % holds on every wheel of the line behind it (`max` with the largest reduction any wheel of the line gives) |
| Wheel inertia | I = 0.14 kg·m² for both wheels, r = 0.311 m: about 1.45 kg more inertial mass (Martin et al. 1998). Vehicles use the same pair |
| Push from rest | Propulsion force at most 0.5 g × mass (rear-tyre grip, μ ≈ 0.8 with about 60 % of the load on it) |
| Drivetrain efficiency | Not added: trainers measure power at the hub, after the chain |
| Air density | ISA troposphere: ρ(h) = ρ₀·(1 − 2.25577·10⁻⁵·h)^4.25588, h from the route's elevation under the rider, folded into `drag_factor`. `joined.physics.air_density` stays ρ₀ |
| Calibration | Unchanged: the table is solo, at sea level, at steady speed |

## Scope

In: the four items above, `docs/protocol.md`, `docs/devices.md`,
`docs/architecture.md`, ADR 0025 (group drafting from the server) and ADR 0026
(inertia, grip and air density).

Out: road surfaces, cornering and braking, wind, trainer `cw` without virtual
shifting (all in the physics audit, separate changes), ERG mode, the grade sent
to a trainer without virtual shifting, and the 20 Hz loop.

## Model

Follower factor, with `t(gap)` the existing linear fade across the window:

```text
f = 1 − min(max_bunch, max(line[depth], max over the line's wheels of max_reduction) + side · n_alongside) · (1 − t(gap))
```

Leader factor, with `gap_behind` the nearest rider whose wheel ahead is this
rider:

```text
f_lead = 1 − leader · (1 − clamp((gap_behind − 2) / (4 − 2), 0, 1))
```

A rider's draft is `f · f_lead`; its `drag_factor` is `draft · ρ(h) / ρ₀`.
The walk follows the line to its front, so a beer bike anywhere ahead counts; it
ends back at the rider round a ring of riders on a short loop, and after one link
per rider in the field at most.

Acceleration:

```text
(min(P / max(v, 1), 0.5 · g · m) − m·g·(sin θ + Crr·cos θ) − ½·ρ₀·CdA·f·v²) / (m + I / r²)
```

Both changes leave every steady speed as it was, so ADR 0019's table holds.

## Risks

- Deeper drafts give bots more surplus, so `pass_urge` pulls them out more
  often: more rotation in a paceline. The bots' draft window is unchanged.
- Big bunches get faster and breakaways harder; race times and route records
  move.
- A leader with a wheel behind slightly out-accelerates the clear-air
  comparison of the pass logic: equal-power followers pass a little less.
- Starts from rest are capped near 4.9 m/s²; sprints build a little slower.
- Synthetic routes' absolute elevations now matter by about 1 % of speed.
