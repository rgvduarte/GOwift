# Group Drafting, Standing Starts and Thin Air Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The server sends its own drag factor and the client rides with it; drafting depends on the place in a group; standing starts are grip-limited and wheels add inertia; air thins with altitude.

**Architecture:**
- **One source for the draft:** `Rider::draft` and `Rider::drag_factor` are set in the tick from what the physics used; `state` sends them; `ride/draft.js` `rideDraft` prefers them over the local mirror.
- **Group drafting** is a pure function in `drafting.rs` (`DraftParams::group_factor`) fed by a per-tick pass over the field (`Field::shelter`): each slot's wheel ahead, its depth in the line, riders alongside and the gap to the wheel behind.
- **Inertia, grip and air density** live in `physics.rs`: `acceleration` divides by `m + I/r²` and caps the push; `air_density_at` gives ρ(h), which the world folds into `drag_factor`.

**Tech Stack:** Rust (sim, server crates; no new deps), plain ES modules client, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-12-group-drafting-and-starts-design.md`

## Global Constraints

- `sim` stays pure: no I/O, async or third-party deps (ADR 0001).
- Protocol stays version 2: `state.drag_factor` (always) and `state.draft` (left out at 1) are additive.
- ERG mode, the grade sent without virtual shifting and the 20 Hz loop are not touched.
- The calibration table (ADR 0019) must pass unchanged.
- One reason to fail per test, no sleeps (CONTRIBUTING.md).
- `cargo fmt --all -- --check`, `cargo clippy --locked --workspace --all-targets -- -D warnings`, `cargo test --locked --workspace`, `npm run lint`, `npm test` before each commit.

## Review Focus

- **Older server:** without `state.drag_factor` the client must behave as today (the mirror). `rideDraft` tests pin it.
- **Clear air vs older server:** `draft` is left out at 1, so the client keys on `drag_factor`, which is always sent.
- **Cycles:** a ring of riders round a velodrome links back to itself; the depth walk stops after four links.
- **Recorded values:** `SOLO_ODOMETER` (vehicles.rs) moves with inertia and with air density; each re-recording says why.

---

### Task 1: The server's own drag factor

- [x] Sim tests: `drag_factor_matches_the_draft_curve_behind_a_wheel`, `a_rider_in_clear_air_has_no_draft`, `a_parked_rider_has_no_draft`, `every_seat_carries_its_vehicles_draft_factor`.
- [x] `Rider::draft`, `Rider::drag_factor`, set in `World::tick` and `step_vehicles`.
- [x] Protocol tests: `state_carries_the_viewers_draft_while_drafting`, `state_always_carries_the_viewers_drag_factor`, `state_leaves_the_draft_out_in_clear_air`; `ServerMessage::State` gains the two fields.
- [x] Client tests in `ride.test.js` for `rideDraft`; `main.js` uses it for shifting and the HUD.
- [x] `docs/protocol.md`, `docs/devices.md`.

### Task 2: Group-aware drafting

- [x] `drafting.rs` tests: `depth_one_keeps_the_single_wheel_curve`, `second_wheel_in_a_line_saves_more_than_the_first`, `riders_alongside_add_shelter_up_to_the_bunch_cap`, `the_leader_gains_a_little_from_a_wheel_right_behind`, `a_beer_bike_keeps_its_draft_deeper_in_the_line`.
- [x] `DraftParams` gains `deeper_wheels`, `side_per_rider`, `side_gap`, `side_lanes`, `max_bunch`, `leader`, `leader_gap`; `GroupPlace` and `group_factor`.
- [x] World tests: `the_third_rider_in_a_line_rides_with_less_drag_than_the_second`, `the_second_wheel_gets_the_second_wheels_draft`, `the_leader_rides_with_less_drag_with_a_wheel_right_behind`, `a_rider_alongside_adds_shelter`, `a_ring_of_riders_on_a_short_loop_terminates`; `drag_factor_matches_the_draft_curve_behind_a_wheel` (task 1) pins a pair to the old curve.
- [x] `Field::shelter` once per tick; the rider step and the vehicles use it.
- [x] ADR 0025, `docs/architecture.md`, `docs/vehicles.md`.

### Task 3: Wheel inertia and a grip-limited push

- [ ] `physics.rs` tests: `wheels_add_inertia_but_not_steady_speed`, `a_standing_start_is_traction_limited`, `the_traction_cap_does_not_bind_at_cruising_speed`.
- [ ] `PhysicsParams` gains `wheel_inertia_kg_m2`, `wheel_radius_m`, `max_drive_g`.
- [ ] Re-record `SOLO_ODOMETER`.

### Task 4: Air density by altitude

- [ ] `physics.rs` tests: `air_density_at_sea_level_is_rho0`, `air_density_at_1000_m_is_isa`; world test `the_same_power_is_faster_high_up`; protocol: the drag factor carries the altitude.
- [ ] `air_density_at`, `Network::elevation`, `Roads::elevation`; the world folds ρ(h)/ρ₀ into `drag_factor` and the clear-air pass comparison.
- [ ] Re-record `SOLO_ODOMETER`; ADR 0026; `docs/protocol.md` (`physics.air_density` is sea level).
