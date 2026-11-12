/**
 * The sky's colour along a view ray, shared by the sky pass and the fog of
 * the lit pass. Fog used to fade far land to one flat horizon colour while
 * the sky behind it carried the sun's halo, so at golden hour and dusk the
 * hills under the sun stood out as a dark band. Fogging towards the sky's own
 * colour along the same ray removes that seam and gives the haze a warm glow
 * towards the sun.
 *
 * The GLSL chunk is written from the same constants as the maths here, so the
 * shaders and the tests cannot drift apart.
 */

export const ATMOSPHERE = Object.freeze({
  /** How fast the sky turns from the horizon colour to the zenith colour with height. */
  horizonCurve: 0.55,
  /**
   * Height (ray y) of the haze band the gradient eases in over: the curve
   * above starts vertical and would draw the horizon as a hard line.
   */
  hazeBand: 0.1,
  /** The sun's halo: [sharpness, strength] (the sky always had it). */
  halo: Object.freeze([12, 0.18]),
  /** A broad forward-scattering glow around the sun: [sharpness, strength], times the scatter. */
  glow: Object.freeze([4, 0.07]),
  /** The sun's disk in the sky pass: [sharpness, strength]. */
  disk: Object.freeze([900, 1.4]),
});

const f = (value) => value.toFixed(4);

/**
 * GLSL for `x` to the whole power `n`, by multiplying: `pow` is a log and an
 * exp, which software GL pays for on every pixel.
 */
export function glslPower(x, n) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Not a whole power: ${n}`);
  return `(${Array.from({ length: n }, () => x).join(" * ")})`;
}

/**
 * `skyAlong(direction, horizon, zenith, sunDirection, sunColor, scatter)`:
 * the sky without the sun's disk, for a unit direction.
 */
export const ATMOSPHERE_GLSL = `
vec3 skyAlong(vec3 d, vec3 horizon, vec3 zenith, vec3 sunDirection, vec3 sunColor, float scatter) {
  float height = clamp(d.y, 0.0, 1.0);
  // On the horizon (all the fog below it) there is nothing to blend.
  float t = height > 0.0 ? pow(height, ${f(ATMOSPHERE.horizonCurve)}) * smoothstep(0.0, ${f(ATMOSPHERE.hazeBand)}, height) : 0.0;
  vec3 sky = mix(horizon, zenith, t);
  float mu = max(dot(d, sunDirection), 0.0);
  return sky + sunColor * (${glslPower("mu", ATMOSPHERE.halo[0])} * ${f(ATMOSPHERE.halo[1])} + scatter * ${glslPower("mu", ATMOSPHERE.glow[0])} * ${f(ATMOSPHERE.glow[1])});
}
vec3 fogAlong(vec3 ray, vec3 horizon, vec3 zenith, vec3 sunDirection, vec3 sunColor, float scatter) {
  if (scatter <= 0.0) return horizon;
  // Land below the horizon takes the haze of the horizon above it (straight down: any horizon will do).
  vec3 level = vec3(ray.x, max(ray.y, 0.0), ray.z);
  float size = length(level);
  return skyAlong(size > 0.000001 ? level / size : vec3(1.0, 0.0, 0.0), horizon, zenith, sunDirection, sunColor, scatter);
}
`;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** GLSL's smoothstep. */
const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};
const normalize = (v) => {
  const length = Math.hypot(v[0], v[1], v[2]);
  return v.map((x) => x / length);
};

/** The sky without the sun's disk along unit direction `d`; `light` is a resolved time-of-day light. */
export function skyAlong(d, { horizon, zenith, sun, sunColor }, scatter = 1) {
  const height = Math.min(1, Math.max(0, d[1]));
  const t = height ** ATMOSPHERE.horizonCurve * smoothstep(0, ATMOSPHERE.hazeBand, height);
  const mu = Math.max(0, dot(d, sun));
  const glow = mu ** ATMOSPHERE.halo[0] * ATMOSPHERE.halo[1] + scatter * mu ** ATMOSPHERE.glow[0] * ATMOSPHERE.glow[1];
  return horizon.map((h, k) => h + (zenith[k] - h) * t + sunColor[k] * glow);
}

/** The sun's disk along unit direction `d`, which only the sky pass draws. */
export function sunDisk(d, { sun, sunColor }) {
  const amount = Math.max(0, dot(d, sun)) ** ATMOSPHERE.disk[0] * ATMOSPHERE.disk[1];
  return sunColor.map((c) => c * amount);
}

/** What the sky pass draws along `direction` (any length) with the world's scatter. */
export function skyColor(direction, light, scatter = 1) {
  const d = normalize(direction);
  const sky = skyAlong(d, light, scatter);
  return sunDisk(d, light).map((c, k) => sky[k] + c);
}

/** The colour fog fades to along a view `ray` (any length); scatter 0 is the flat horizon colour. */
export function fogColor(ray, light, scatter = 1) {
  if (scatter <= 0) return light.horizon;
  const level = [ray[0], Math.max(ray[1], 0), ray[2]];
  return skyAlong(Math.hypot(...level) > 1e-6 ? normalize(level) : [1, 0, 0], light, scatter);
}
