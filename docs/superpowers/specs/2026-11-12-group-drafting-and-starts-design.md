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
| Depth in a line | Reduction 30 / 40 / 45 / 48 % on the 1st / 2nd / 3rd / 4th-and-later wheel of a same-lane line whose every link is inside the draft window; each step up counts as far as the links up to that depth are close (the window's fade), so the draft stays continuous as a link opens |
| Riders alongside | Up to +4 % per rider ahead in a neighbouring lane (≤ 1.5 lanes off), only for a rider on a wheel: all of it 2 m ahead, nothing level or 4 m ahead |
| Bunch cap | 60 % (Blocken et al. 2018 measured 90–95 % deep in a peloton; game riders hold perfect position and nobody is gapped by crosswind) |
| Leader | 2.6 % less drag with a wheel 2 m behind, fading to none at 4 m (Blocken et al. 2013) |
| Draft window | Unchanged (2–6.5 m, linear fade): bots' `draft_window` and the spacing logic stay valid |
| Beer bike | Its 50 % holds on every wheel of a closed-up line behind it (each step up the line also rises to the largest reduction any wheel up to there gives) |
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

Follower factor, with `c(gap) = 1 − t(gap)` the closeness in the window (1 from
2 m in, 0 at 6.5 m and beyond) and wheels `k = 1…n` of the line ahead, nearest
first, link `k` running from wheel `k − 1` (the rider for `k = 1`) to wheel `k`,
and `deeper[k]` 40 / 45 / 48 % for `k` = 2 / 3 / 4 and later (none for `k = 1`):

```text
L_k  = max(L_(k−1), deeper[k], max_reduction of wheel k)     (L_0 = 0)
R    = Σ_k (L_k − L_(k−1)) · c(gap_2) · … · c(gap_k)
side = Σ_alongside min(gap / 2, (4 − gap) / (4 − 2)) clamped to 0…1
f    = 1 − min(max(max_bunch, R), R + 0.04 · side) · c(gap_1)
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
