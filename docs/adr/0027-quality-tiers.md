# 27. Graphics quality tiers: detected, governed, never raised behind the rider's back

Date: 2026-11-12 · Status: accepted

## Context

The 3D view had one switch, *Graphics: High / Low*, and it defaulted to high for
everyone. A browser drawing WebGL on the CPU (SwiftShader, llvmpipe, Windows'
"Microsoft Basic Render Driver" in a VM or over remote desktop) therefore started
with the 2048² shadow pass, a device pixel ratio of 2, the grass and flower
chunks and 4× multisampling, and showed a slide show until the rider found the
switch. Headless Chromium, which the screenshot tooling uses, is such a browser.

The ride also wrote "high" into `openride.quality` every time it started, so the
stored value could not tell a rider's pick from the default.

New effects make the gap wider: some are cheap enough for every device (a sky-
aware fog, water reflection, rider body motion), others only pay off on a real
GPU (animated wave normals).

## Decision

- **Two tiers, one contract** (`client/public/js/view3d/quality.js`):

  | | low | high |
  | --- | --- | --- |
  | Device pixel ratio | 1 | up to 2 |
  | Sun shadow map | off | 2048², ±65 m around the rider |
  | Grass and flowers (`detail` chunks) | off | on |
  | Multisampling | off when the session *starts* low | on |
  | Fog towards the sky along the view ray, glow around the sun | on | on |
  | Open water mirrors the sky (Fresnel) and glints in the sun | on | on |
  | Moving waves on open water (swell and chop) | off | on |
  | Riders out of the saddle, rocking bikes, own cadences (CPU only, no extra draws) | on | on |
  | Ambient occlusion baked into trees, rocks and clouds at world build (no GPU cost) | on | on |

  New effects that cost little run on both tiers; the rest are high only.
  They are switched by uniforms inside the one mesh program, not by `#define`
  variants, so both tiers run the same compiled shader and the low tier (which
  the menu island always uses) compile-checks all of it.
- **The rider's pick always wins.** It lives in a new key, `goindoor.quality`,
  written only when the rider picks a tier: the Graphics row of the top bar's
  View popover (on roads and in the studio) or the button in Menu → View. Of
  the old key only a stored `low` counts as a pick; its `high` was written on
  every ride start and is ignored.
- **Without a pick the tier is detected** from the WebGL renderer's name (read
  once from a throwaway context, then released), the data-saver flag,
  `navigator.deviceMemory ≤ 2` and `hardwareConcurrency ≤ 2`. Hints the
  browser hides count as fine. The renderer name is a fingerprinting surface:
  it is used for the tier and never sent or stored.
- **A frame-time governor** (`FrameBudget`) watches the drawn 3D frames of the
  ride and the studio. When the median frame over the last 5 s is above 40 ms
  (under 25 fps), an automatic high tier drops to low once and a ticker line
  says so and points to View, where the rider can raise it again. It never raises a tier and never touches a tier the rider picked.
  Gaps of a second or more (a hidden tab) are not frames.
- **Multisampling is a context attribute** and cannot change while the canvas
  lives, so it follows the tier the session starts on; the button's tooltip
  says edge smoothing follows after a reload.
- **The menu island** stays for an automatic low tier (it always draws low);
  only a rider who picked low, or data saver, gets the flat 2D menu as before.

## Consequences

- Software GL and low-memory devices start on the cheap path; capable GPUs keep
  every effect. Firefox hides the renderer name, so there the governor does the
  work.
- A strong machine seen through a basic display driver (remote desktop, a VM)
  starts low; the button still works and the pick is remembered.
- Riders who rode before this change and never pressed the button are detected
  afresh once; riders who picked low keep low.
- A future high-only effect only has to check `View3D.quality` and add a row to
  the table above.
