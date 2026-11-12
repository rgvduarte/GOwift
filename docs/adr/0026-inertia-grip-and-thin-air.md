# 26. Wheels have inertia, the push from rest has a grip limit, and the air thins with altitude

Date: 2026-11-12 · Status: accepted

## Context

The physics (ADR 0019) turned power into force as `P / max(v, 1 m/s)` and
divided by the mass of rider and bike. From a standstill that is
unrealistic: 1000 W pushes 85 kg at 1.2 g for the first metre, and every race
starts from 0. At a low tick rate (`GOINDOOR_TICK_HZ` allows 1) one tick jumps
straight to the speed limit. Real starts are limited by the rear tyre: with
μ ≈ 0.8 on dry asphalt and about 60 % of the weight on the rear wheel a bike
can push at about 0.48 g, and the front wheel lifts at about the same.

Speed changes also ignored the wheels: they spin up with the bike. Martin et
al. 1998 (*J. Appl. Biomech.* 14:276–291) measured I = 0.14 kg·m² for a pair
of road wheels at r = 0.311 m, which a rider accelerates like I/r² ≈ 1.45 kg
of extra mass.

The air density was the sea-level 1.225 kg/m³ everywhere. The bundled routes
reach about 590 m, where the air is 5.5 % thinner; an imported climb at 2000 m
has about 18 % less drag.

## Decision

- `acceleration` divides the net force by `m + I/r²` (`wheel_inertia_kg_m2`
  0.14, `wheel_radius_m` 0.311). Every body counts one pair of wheels; a
  vehicle's own mass dwarfs the difference.
- The push is at most `max_drive_g` (0.5) × m × g.
- No drivetrain efficiency: trainers measure power at the hub, after the
  chain, and the calibrated Crr takes the rest.
- Air density follows the ISA troposphere (ISO 2533: 288.15 K at sea level,
  6.5 K/km): `ρ(h) = ρ₀·(1 − 2.25577·10⁻⁵·h)^4.25588`, with h the elevation
  of the road under the rider (on or off its route), held from 11 km up. The
  world folds `ρ(h)/ρ₀` into the same drag factor as the draft, so the physics
  step and `state.drag_factor` carry it without a new input or field;
  `PhysicsParams::air_density` and `joined.physics.air_density` stay ρ₀. The
  clear-air comparison of the pass logic uses the thin air too.

## Consequences

- Inertia and grip leave every steady speed as it was, and the calibration
  table of ADR 0019 is ridden at sea level, so it still passes untouched.
- Speed changes are about 1.7 % softer; race starts and attacks from very low
  speed build at most about 4.9 m/s². Sprints take a moment longer to build.
- Route elevations are now metres above sea level that matter: riders are
  about 1–2 % faster on the higher bundled routes, and lap times and records
  there move slightly. A synthetic route's base elevation is part of its feel.
- Recorded values move a little (the vehicles test's solo odometer: 0.32 m
  less over a minute from a standing start, 0.59 m more 100 m up).
- No protocol change beyond what `state.drag_factor` already carries; virtual
  shifting follows it, so the pedals feel the thinner air too. The HUD's
  drafting share (`state.draft`) leaves the air out. Trainer grades without
  virtual shifting and ERG are unaffected.
