import { test } from "node:test";
import assert from "node:assert/strict";
import { ATMOSPHERE, ATMOSPHERE_GLSL, fogColor, skyColor, sunDisk } from "../public/js/view3d/atmosphere.js";
import { TIME_PRESETS, resolvedLight } from "../public/js/view3d/lighting.js";
import { BIOMES } from "../public/js/view3d/biomes/index.js";
import { MESH_FRAGMENT, SKY_FRAGMENT } from "../public/js/view3d/renderer.js";

/** Every time of day in every biome, as the view resolves it. */
const LIGHTS = Object.values(BIOMES).flatMap((biome) => Object.entries(TIME_PRESETS).map(([key, preset]) => ({ name: `${biome.id} ${key}`, light: resolvedLight({ key, ...preset }, biome) })));
const azimuths = Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2);
const horizontal = (a) => [Math.cos(a), 0, Math.sin(a)];
/** One 8-bit colour step: closer than that nobody sees a seam. */
const STEP = 1 / 255;
const near = (a, b, eps, message) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) <= eps, `${message}: ${a} vs ${b}`));
const minus = (a, b) => a.map((v, i) => v - b[i]);

test("far land fades into the sky behind it: along the horizon the fog has the sky's colour", () => {
  for (const { name, light } of LIGHTS) {
    for (const a of azimuths) {
      const ray = horizontal(a);
      // The sky pass also draws the sun's disk; land is never in front of that and nowhere else does it show.
      near(fogColor(ray, light), minus(skyColor(ray, light), sunDisk(ray, light)), STEP, `${name} at ${a.toFixed(2)}`);
    }
  }
});

test("land below the horizon takes the fog of the horizon above it", () => {
  for (const { name, light } of LIGHTS) {
    const ray = [Math.cos(1), -0.4, Math.sin(1)];
    near(fogColor(ray, light), fogColor(horizontal(1), light), 1e-9, name);
  }
});

test("at golden hour the haze glows warm towards the sun", () => {
  const light = resolvedLight({ key: "golden", ...TIME_PRESETS.golden }, BIOMES.temperate);
  const towards = [light.sun[0], 0, light.sun[2]];
  const away = towards.map((v) => -v);
  assert.ok(fogColor(towards, light)[0] > fogColor(away, light)[0] + 0.1);
});

test("the glow reaches wide around the sun, not just its halo", () => {
  const light = resolvedLight({ key: "golden", ...TIME_PRESETS.golden }, BIOMES.temperate);
  const angle = Math.atan2(light.sun[2], light.sun[0]) + Math.PI / 4;
  const without = fogColor(horizontal(angle), light, 0.0001);
  assert.ok(fogColor(horizontal(angle), light)[0] > without[0] + STEP, "45° off the sun is still warmer");
});

test("the sky leaves the horizon in a soft haze, not along a hard line", () => {
  for (const { name, light } of LIGHTS) {
    const away = Math.atan2(light.sun[2], light.sun[0]) + Math.PI;
    const at = (y) => skyColor([Math.cos(away), y, Math.sin(away)], light);
    near(at(0.01), at(0), 2 * STEP, `${name} just above the horizon`);
    assert.ok(Math.abs(at(0.6)[2] - light.zenith[2]) < Math.abs(at(0.6)[2] - light.horizon[2]), `${name}: high up the sky is mostly zenith`);
  }
});

test("without scatter the fog is the flat horizon colour (the studio)", () => {
  const [{ light }] = LIGHTS;
  for (const ray of [horizontal(0.3), [0.2, 0.9, 0.1], [0, -1, 0]]) assert.deepEqual(fogColor(ray, light, 0), light.horizon);
});

test("looking straight down still gives a fog colour", () => {
  for (const { name, light } of LIGHTS) assert.ok(fogColor([0, -1, 0], light).every(Number.isFinite), name);
});

test("the sky and the lit world share one atmosphere chunk", () => {
  for (const [name, source] of [
    ["sky", SKY_FRAGMENT],
    ["mesh", MESH_FRAGMENT],
  ]) {
    assert.ok(source.includes(ATMOSPHERE_GLSL), `${name} pass includes the chunk`);
    assert.match(source, /skyAlong\(/, `${name} pass calls it`);
  }
});

test("the shader's atmosphere uses the same constants as the maths here", () => {
  for (const value of [ATMOSPHERE.horizonCurve, ATMOSPHERE.hazeBand, ...ATMOSPHERE.halo, ...ATMOSPHERE.glow]) assert.ok(ATMOSPHERE_GLSL.includes(value.toFixed(4)), `${value}`);
});
