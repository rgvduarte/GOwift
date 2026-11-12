import { test } from "node:test";
import assert from "node:assert/strict";
import { Renderer } from "../public/js/view3d/renderer.js";
import { TIME_PRESETS } from "../public/js/view3d/lighting.js";
import { identity } from "../public/js/view3d/math.js";
import { fakeGl } from "./fakeGl.js";

const FRAME = { viewProjection: identity(), inverseViewProjection: identity(), camera: [0, 2, 0], ...TIME_PRESETS.golden };
const mesh = { positions: new Float32Array(9), normals: new Float32Array(9), colors: new Float32Array(12), vertexCount: 3 };

test("the sky fills in only what the world left uncovered", () => {
  // Drawn after the opaque world on the far plane, where the depth is still the cleared one:
  // covered pixels fail the depth test before they are shaded.
  const gl = fakeGl();
  const renderer = new Renderer(gl);
  renderer.begin(FRAME);
  renderer.draw(renderer.upload(mesh), identity());
  renderer.drawSky();
  const sky = gl.draws.at(-1);
  assert.equal(sky.program, renderer.skyProgram);
  assert.deepEqual([sky.enabled.has("DEPTH_TEST"), sky.depthFunc, sky.depthMask], [true, "LEQUAL", false]);
});

test("the world after the sky is drawn as usual", () => {
  const gl = fakeGl();
  const renderer = new Renderer(gl);
  renderer.begin(FRAME);
  renderer.drawSky();
  renderer.drawTransparent(renderer.upload(mesh), identity(), { alpha: 0.5 });
  const water = gl.draws.at(-1);
  assert.deepEqual([water.program === renderer.program, water.enabled.has("DEPTH_TEST"), water.depthFunc], [true, true, "LESS"]);
});

test("water is shaded as water only while it is drawn", () => {
  const gl = fakeGl();
  const renderer = new Renderer(gl);
  renderer.begin(FRAME);
  const sea = renderer.upload(mesh);
  renderer.drawTransparent(sea, identity(), { alpha: 0.8, water: 2 });
  assert.equal(gl.draws.at(-1).uniforms.get("u_water"), 2);
  renderer.draw(sea, identity());
  assert.equal(gl.draws.at(-1).uniforms.get("u_water"), 0, "the next mesh is not water");
});

test("the waves' clock wraps every hour, so their phases stay precise", () => {
  const gl = fakeGl();
  const renderer = new Renderer(gl);
  renderer.begin({ ...FRAME, timeS: 3600 * 50 + 12.5 });
  assert.equal(gl.uniform(renderer.program, "u_time"), 12.5);
});

test("the sky and the world share the frame's scatter", () => {
  const gl = fakeGl();
  const renderer = new Renderer(gl);
  renderer.begin({ ...FRAME, scatter: 1 });
  assert.deepEqual([gl.uniform(renderer.skyProgram, "u_scatter"), gl.uniform(renderer.program, "u_scatter")], [1, 1]);
  renderer.begin(FRAME);
  assert.equal(gl.uniform(renderer.program, "u_scatter"), 0, "the studio's default: flat horizon fog");
});
