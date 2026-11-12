# 26. Wheels have inertia and the push from rest has a grip limit

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

## Decision

- `acceleration` divides the net force by `m + I/r²` (`wheel_inertia_kg_m2`
  0.14, `wheel_radius_m` 0.311). Every body counts one pair of wheels; a
  vehicle's own mass dwarfs the difference.
- The push is at most `max_drive_g` (0.5) × m × g.
- No drivetrain efficiency: trainers measure power at the hub, after the
  chain, and the calibrated Crr takes the rest.

## Consequences

- Every steady speed stays as it was, so the calibration table of ADR 0019
  still passes untouched.
- Speed changes are about 1.7 % softer; race starts and attacks from very low
  speed build at most about 4.9 m/s². Sprints take a moment longer to build.
- Recorded values that start from rest move a little (the vehicles test's
  solo odometer: 0.32 m less over a minute).
- No protocol change; trainer grades, virtual shifting and ERG are unaffected.
