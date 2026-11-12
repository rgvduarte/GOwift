# Graphics: quality tiers and look — implementation plan

Spec: [2026-11-12-graphics-tiers-and-look-design.md](../specs/2026-11-12-graphics-tiers-and-look-design.md)
· ADR: [0025 quality tiers](../../adr/0025-quality-tiers.md)

Each step starts with its failing test and ends with `npm run lint`, `npm test`
and `npm run preload` green, then one Conventional Commit.

1. **Quality tiers** (prerequisite)
   - `view3d/quality.js`: `detectQuality`, `webglRendererName` (throwaway
     context, released), `chosenQuality`, `FrameBudget`, `QualityGovernor`.
   - `createContext(canvas, { antialias })`; `View3D` and `StudioView3D` take
     `antialias`.
   - `main.js`: one governor per page; `chooseQuality` (button, stored),
     `applyQuality` (view and studio, not stored), `governFrame` after each
     drawn 3D frame; the menu island hides only for a picked low tier.
   - i18n: `graphics.autoLow`, the button's tooltip; ADR 0025.
2. **Sky fix** (`fix:`): draw the sky pass without the depth test;
   `test/fakeGl.js` and `renderer.test.js`.
3. **Atmosphere**: `view3d/atmosphere.js` (`skyAlong`, `fogColor`,
   `ATMOSPHERE_GLSL` with `skyAlong`/`fogAlong`); both passes include it;
   `begin({ scatter })`, `View3D` passes 1, the studio keeps 0.
4. **Water**: `view3d/water.js` (`fresnel`, `mirrorShare`, `waveNormal`,
   `waterMode`, `WATER_GLSL`); `u_water`/`u_time`; `drawTransparent({ water })`;
   the sea and rivers by tier, ice excluded.
5. **Rider motion**: `rotationZAbout`; `legPose(phase, hip)`, `STANDING_HIP`,
   `riderStance`, `ridingBodyParts(look, stance)` with arm IK;
   `view3d/riderMotion.js` (`riderMotion`, `saddleState`, `climbsStanding`,
   `packCadence`); `View3D` keeps a saddle state per rider and gets `myFtp`.
6. **Baked shading**: `verticalShade`, `MeshBuilder.shaded`, chunk routing;
   trees, bushes, rocks (both biomes) and clouds.
7. **Shader cost** (`perf:`): whole powers multiplied out (`glslPower`), the
   sky gradient skipped on the horizon, the sun's disk and glint gated near
   the sun; measured in headless Chromium (software GL).
8. Docs: `architecture.md` rows, ADR rows per effect; screenshots before and
   after (menu, Rolling Hills, Cape Loop with the sea, drone camera) in headless
   Chromium against the release server.
