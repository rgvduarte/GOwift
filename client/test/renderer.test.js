import { test } from "node:test";
import assert from "node:assert/strict";
import { Renderer } from "../public/js/view3d/renderer.js";
import { TIME_PRESETS } from "../public/js/view3d/lighting.js";
import { identity } from "../public/js/view3d/math.js";
import { fakeGl } from "./fakeGl.js";

const FRAME = { viewProjection: identity(), inverseViewProjection: identity(), camera: [0, 2, 0], ...TIME_PRESETS.golden };
const mesh = { positions: new Float32Array(9), normals: new Float32Array(9), colors: new Float32Array(12), vertexCount: 3 };

test("the sky is drawn behind everything, past the cleared depth buffer", () => {
  // The sky triangle sits on the far plane, at the cleared depth; a depth test would throw it all away.
  const gl = fakeGl();
  const renderer = new Renderer(gl);
  renderer.begin(FRAME);
  const sky = gl.draws.find((d) => d.program === renderer.skyProgram);
  assert.ok(sky, "the sky pass draws");
  assert.deepEqual([sky.enabled.has("DEPTH_TEST"), sky.depthMask], [false, false]);
});

test("the world after the sky is depth tested again", () => {
  const gl = fakeGl();
  const renderer = new Renderer(gl);
  renderer.begin(FRAME);
  renderer.draw(renderer.upload(mesh), identity());
  const world = gl.draws.at(-1);
  assert.deepEqual([world.program === renderer.program, world.enabled.has("DEPTH_TEST"), world.depthMask], [true, true, true]);
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
