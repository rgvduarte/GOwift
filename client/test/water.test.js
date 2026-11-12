import { test } from "node:test";
import assert from "node:assert/strict";
import { WATER, WATER_GLSL, fresnel, mirrorShare, waterMode, waveNormal } from "../public/js/view3d/water.js";
import { MESH_FRAGMENT } from "../public/js/view3d/renderer.js";

test("water reflects little looking straight down and everything at a grazing angle", () => {
  assert.equal(fresnel(1), WATER.f0);
  assert.equal(fresnel(0), 1);
  for (let c = 0; c < 1; c += 0.05) assert.ok(fresnel(c) >= fresnel(c + 0.05), `falls as the view steepens at ${c}`);
});

test("even seen flat, the sea keeps some of its own colour", () => {
  assert.ok(mirrorShare(0) <= 0.7, "the sky never takes over the whole sea");
  assert.ok(mirrorShare(0.1) > mirrorShare(0.9) * 10, "it still mirrors far more at a grazing angle");
});

test("the waves tilt the surface a little, never much", () => {
  for (let x = -500; x <= 500; x += 37) {
    for (let z = -500; z <= 500; z += 41) {
      const n = waveNormal(x, z, 12.5);
      assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-9, "unit length");
      assert.ok(Math.hypot(n[0], n[2]) / n[1] <= WATER.maxSlope, `slope at ${x}, ${z}`);
    }
  }
});

test("on average the sea lies flat", () => {
  const sum = [0, 0, 0];
  let count = 0;
  for (let x = 0; x < 1000; x += 3.7) {
    for (let z = 0; z < 1000; z += 4.3) {
      waveNormal(x, z, 40).forEach((v, k) => (sum[k] += v));
      count += 1;
    }
  }
  assert.ok(Math.hypot(sum[0] / count, sum[2] / count) < 0.01);
});

test("the waves move with time", () => {
  assert.notDeepEqual(waveNormal(10, 20, 0), waveNormal(10, 20, 1));
});

test("the sea gets waves on high, reflections on both tiers; ice gets neither", () => {
  assert.equal(waterMode({ high: true }), 2);
  assert.equal(waterMode({ high: false }), 1);
  assert.equal(waterMode({ high: true, ice: true }), 0);
});

test("the lit pass shades water with the same waves as the maths here", () => {
  assert.ok(MESH_FRAGMENT.includes(WATER_GLSL));
  for (const wave of WATER.waves) for (const value of wave) assert.ok(WATER_GLSL.includes(value.toFixed(4)), `${value}`);
});
