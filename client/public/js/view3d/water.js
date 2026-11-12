/**
 * How open water is shaded: it mirrors the sky more the flatter you look
 * across it (Schlick's Fresnel), the sun glints off it, and on the high tier
 * slow swell and a short chop move its normal so the glint breaks into a
 * glitter path. The GLSL chunk is written from the constants here, so the
 * shader and the tested maths cannot drift apart.
 */

/** [slope, kx, kz, speed]: a wave's steepest slope, its wave vector (rad/m) and phase speed (rad/s). */
const SWELL = Object.freeze([
  Object.freeze([0.03, 0.11, 0.03, 0.9]),
  Object.freeze([0.03, -0.05, 0.21, 1.3]),
  Object.freeze([0.03, 0.02, 0.13, -0.7]),
  Object.freeze([0.02, 0.19, -0.07, 1.1]),
]);
/** Short waves (7–8 m): they make the glitter, and fade out with distance before they alias. */
const CHOP = Object.freeze([Object.freeze([0.015, 0.71, 0.33, 2.3]), Object.freeze([0.015, -0.42, 0.83, 2.9])]);

export const WATER = Object.freeze({
  /** Reflectance looking straight down (water's index of refraction, 1.33). */
  f0: 0.02,
  swell: SWELL,
  chop: CHOP,
  waves: Object.freeze([...SWELL, ...CHOP]),
  /** The chop fades out between these distances (metres). */
  chopFade: Object.freeze([60, 400]),
  /** Further out the swell calms too: seen flat, rows of crests would read as stripes. */
  swellFade: Object.freeze([400, 1800]),
  /**
   * The largest share of the colour the mirrored sky takes. Physically a
   * grazing view is a perfect mirror, but the pale sky at the horizon would
   * then wash the sea out to the sky's colour; the sea keeps some of its own.
   */
  mirror: 0.65,
  /** The steepest the surface can tilt (all crests lined up). */
  maxSlope: [...SWELL, ...CHOP].reduce((sum, [slope]) => sum + slope, 0),
  /** The sun's glint: [sharpness, strength]. */
  glint: Object.freeze([160, 1.6]),
});

/** The water shading for a surface: 0 none (ice), 1 reflection and glint, 2 also moving waves (high tier). */
export function waterMode({ high, ice = false }) {
  if (ice) return 0;
  return high ? 2 : 1;
}

/** Share of light the surface reflects at `cosine` between the view and the normal (Schlick). */
export function fresnel(cosine) {
  return WATER.f0 + (1 - WATER.f0) * (1 - cosine) ** 5;
}

/** Share of the drawn colour that is mirrored sky at `cosine` between the view and the normal. */
export function mirrorShare(cosine) {
  return WATER.mirror * fresnel(cosine);
}

/** The slope (x, z) the waves give at world (x, z) at time `t` seconds. */
function slope(waves, x, z, t) {
  let gx = 0;
  let gz = 0;
  for (const [s, kx, kz, w] of waves) {
    const k = Math.hypot(kx, kz);
    const c = s * Math.cos(kx * x + kz * z + w * t);
    gx += (c * kx) / k;
    gz += (c * kz) / k;
  }
  return [gx, gz];
}

/** The water's unit normal at world (x, z) at time `t`; `chop` (0–1) scales the short waves. */
export function waveNormal(x, z, t, chop = 1) {
  const [sx, sz] = slope(WATER.swell, x, z, t);
  const [cx, cz] = slope(WATER.chop, x, z, t);
  const n = [-(sx + chop * cx), 1, -(sz + chop * cz)];
  const length = Math.hypot(...n);
  return n.map((v) => v / length);
}

const f = (value) => value.toFixed(4);
const terms = (waves) =>
  waves
    .map(([s, kx, kz, w]) => {
      const k = Math.hypot(kx, kz);
      return `${f(s)} * cos(dot(q, vec2(${f(kx)}, ${f(kz)})) + ${f(w)} * t) * vec2(${f(kx / k)}, ${f(kz / k)})`;
    })
    .join("\n    + ");

/** `waveNormal(q, t, chop)` and `mirrorShare(cosine)` for the lit pass. */
export const WATER_GLSL = `
vec3 waveNormal(vec2 q, float t, float chop) {
  vec2 swell = ${terms(SWELL)};
  vec2 ripples = ${terms(CHOP)};
  vec2 g = swell + chop * ripples;
  return normalize(vec3(-g.x, 1.0, -g.y));
}
float mirrorShare(float cosine) {
  return ${f(WATER.mirror)} * (${f(WATER.f0)} + ${f(1 - WATER.f0)} * pow(1.0 - cosine, 5.0));
}
`;
