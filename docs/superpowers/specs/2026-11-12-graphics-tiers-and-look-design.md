# Graphics: quality tiers, sky and fog, water, rider motion, baked shading — design

Date: 2026-11-12 · Status: implemented on `impl/graphics`

## Goal

Make the 3D world look better where every rider sees it (the menu flyover, the
chase camera, the coast) without making it worse where the device is weak.
First pick the right tier per device, then spend that budget on cheap,
visible effects that run on both tiers, and keep the expensive ones on high.

## Decisions

| Question | Decision |
| --- | --- |
| Tiers | Keep two, `high` and `low`; the contract is in [ADR 0027](../../adr/0027-quality-tiers.md) |
| Default tier | Detected until the rider presses the button: software WebGL (SwiftShader, llvmpipe, Basic Render), data saver, `deviceMemory ≤ 2` or two cores start low |
| Rider's pick | New key `goindoor.quality`, written only by the button. The old key was written "high" on every ride start, so only its "low" still counts |
| Governor | Median frame over 5 s above 40 ms drops an automatic high tier to low once, with a ticker line; never raises, never touches a pick |
| Multisampling | A context attribute: follows the tier the session starts on (the tooltip says it changes after a reload) |
| Effect switches | Uniform branches in the one mesh program, no `#define` variants: the always-low menu island compile-checks every path |
| Sky | The sky pass never drew (its triangle sat at the cleared depth); fixed first, then eased off the horizon in a haze band |
| Fog | Towards the sky's colour along each view ray (flattened to the horizon below it), plus a broad glow around the sun. Studio keeps flat fog (`scatter` 0) |
| Water | Schlick Fresnel mirror of the same sky, capped at 65 % so the sea keeps its colour; sun glint on both tiers; swell and chop normals on high, the chop fading out by 400 m, the swell by 1.8 km. Ice rivers stay unshaded |
| Rider motion | Stand for sprint/attack/answer, ramps over 8 % (climbers and 40 % of riders by habit), my own power over 1.4 × FTP. Held 1.5 s, eased 0.35 s. Hips forward over the cranks, hands kept on the hoods by arm IK, bike rock ±0.14 rad standing with the body leaning against it. Others pedal at 82–90 rpm by id |
| Baked shading | A `MeshBuilder.shaded` hook bakes a per-vertex brightness into the colour (alpha, the tint mask, untouched). Trees, bushes, rocks and clouds use a vertical gradient |
| Shared maths | `atmosphere.js` and `water.js` write their GLSL chunks from the same constants their JS twins are tested with |

## Out of scope

- Terrain concavity and forest-floor darkening (audit item 3, second half):
  needs a height or canopy pass in the worker; later.
- Road micro-detail and wind sway (audit items 6 and 7): high-only effects
  that can now build on the tier contract.
- A linear/ACES pipeline: every biome palette is tuned for the current
  gamma-space lighting.

## Testing

- `quality.test.js`: detection strings, the stored-pick rules, the frame budget
  (slow frames trip it, spikes and pauses do not, it never flips back), the
  governor and the context's multisampling.
- `renderer.test.js` with a fake WebGL context (`test/fakeGl.js`): the sky draws
  past the cleared depth, the world is depth tested again, `scatter`, `u_water`
  and the wrapped wave clock reach the right programs.
- `atmosphere.test.js`, `water.test.js`: the seam (fog along the horizon equals
  the sky there, for every time of day in every biome), the warm glow towards
  the sun, the haze band, Fresnel limits, the mirror cap, unit and bounded wave
  normals, and that the shaders carry the constants.
- `riderMotion.test.js`, `view3d.test.js`: the feet reach the pedals seated and
  standing, the hands stay on the hoods, the rock is even and bounded, the
  standing hysteresis, and a sprinting bot (or my surge) rocks its bike while a
  cruising rider stays upright.
- `mesh.test.js`, `biomes.test.js`: unshaded meshes keep their colours, shading
  ends with its block and survives chunk routing, trees and clouds are darker
  underneath in both biomes.
- Screenshots in headless Chromium (software GL, so it also checks the low tier
  is picked) of the menu, Rolling Hills, Cape Loop and the drone camera.
