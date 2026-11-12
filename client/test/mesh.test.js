import { test } from "node:test";
import assert from "node:assert/strict";
import { MeshBuilder, verticalShade } from "../public/js/view3d/meshBuilder.js";
import { ChunkedMesh } from "../public/js/view3d/chunks.js";
import { dot, sub } from "../public/js/view3d/math.js";

/** Every face normal must point away from `inside`. */
function assertOutward(mesh, inside) {
  for (let i = 0; i < mesh.vertexCount; i += 3) {
    const centroid = [0, 1, 2].map((axis) => (mesh.positions[i * 3 + axis] + mesh.positions[(i + 1) * 3 + axis] + mesh.positions[(i + 2) * 3 + axis]) / 3);
    const normal = [mesh.normals[i * 3], mesh.normals[i * 3 + 1], mesh.normals[i * 3 + 2]];
    assert.ok(dot(normal, sub(centroid, inside)) > -1e-9, `triangle ${i / 3} faces inwards`);
  }
}

test("boxes have 12 outward-facing triangles", () => {
  const mesh = new MeshBuilder();
  mesh.box([1, 2, 3], [2, 1, 4], [1, 0, 0]);
  const built = mesh.build();
  assert.equal(built.vertexCount, 36);
  assertOutward(built, [1, 2, 3]);
});

test("segments are boxes along the segment, facing outwards", () => {
  const mesh = new MeshBuilder();
  mesh.segment([0, 0, 0], [0, 1, -1], 0.2, 0.1, [1, 1, 1, 1]);
  const built = mesh.build();
  assertOutward(built, [0, 0.5, -0.5]);
  assert.equal(built.colors[3], 1, "alpha carries the tint mask");
});

test("wheels and cones face outwards", () => {
  const wheel = new MeshBuilder();
  wheel.wheel([0, 0.34, 0], 0.34, 0.04, [0, 0, 0]);
  assertOutward(wheel.build(), [0, 0.34, 0]);

  const cone = new MeshBuilder();
  cone.cone([5, 0, 5], 2, 6, [0, 1, 0]);
  assertOutward(cone.build(), [5, 1.5, 5]);
});

test("normals are unit length", () => {
  const mesh = new MeshBuilder();
  mesh.box([0, 0, 0], [1, 2, 3], [1, 1, 1]);
  const { normals } = mesh.build();
  for (let i = 0; i < normals.length; i += 3) {
    assert.ok(Math.abs(Math.hypot(normals[i], normals[i + 1], normals[i + 2]) - 1) < 1e-6);
  }
});

test("ellipsoids face outwards and discs face up", () => {
  const blob = new MeshBuilder();
  blob.ellipsoid([1, 2, 3], [2, 1, 1.5], [0, 1, 0], 4, 8);
  assertOutward(blob.build(), [1, 2, 3]);
  const disc = new MeshBuilder();
  disc.disc([0, 0.1, 0], [1, 2], [0, 0, 0], 12, 0.7);
  const { normals, vertexCount } = disc.build();
  for (let i = 0; i < vertexCount; i += 1) assert.ok(normals[i * 3 + 1] > 0.99);
});

// --- baked shading (ambient occlusion) --------------------------------------------

/** Brightness (red channel) and tint mask of the lowest and the highest vertex of a mesh. */
function bottomAndTop(mesh) {
  let low = { y: Infinity };
  let high = { y: -Infinity };
  for (let v = 0; v < mesh.vertexCount; v += 1) {
    const y = mesh.positions[v * 3 + 1];
    const entry = { y, red: mesh.colors[v * 4], alpha: mesh.colors[v * 4 + 3] };
    if (y < low.y) low = entry;
    if (y > high.y) high = entry;
  }
  return { low, high };
}

test("without shading the colours are exactly as given", () => {
  const mesh = new MeshBuilder();
  mesh.ellipsoid([0, 5, 0], [1, 1, 1], [0.5, 0.8, 0.4, 1], 4, 7);
  const { colors } = mesh.build();
  for (let i = 0; i < colors.length; i += 4) assert.deepEqual([...colors.slice(i, i + 4)], [0.5, 0.800000011920929, 0.4000000059604645, 1]);
});

test("a shaded crown is darker underneath than on top, and keeps its tint mask", () => {
  const mesh = new MeshBuilder();
  mesh.shaded(verticalShade(4, 6, 0.6), () => mesh.ellipsoid([0, 5, 0], [1, 1, 1], [0.5, 0.8, 0.4, 1], 4, 7));
  const { low, high } = bottomAndTop(mesh.build());
  assert.ok(Math.abs(low.red - 0.3) < 1e-6, "the underside takes the darkest shade");
  assert.ok(Math.abs(high.red - 0.5) < 1e-6, "the top keeps its colour");
  assert.deepEqual([low.alpha, high.alpha], [1, 1]);
});

test("shading ends with the shaded block", () => {
  const mesh = new MeshBuilder();
  mesh.shaded(
    () => 0.5,
    () => mesh.box([0, 0, 0], [1, 1, 1], [1, 1, 1]),
  );
  mesh.box([5, 0, 0], [1, 1, 1], [1, 1, 1]);
  const built = mesh.build();
  assert.deepEqual([built.colors[0], built.colors[built.colors.length - 4]], [0.5, 1]);
});

test("a chunked mesh shades what it routes into its chunks", () => {
  const mesh = new ChunkedMesh(100);
  mesh.shaded(verticalShade(0, 10, 0.5), () => mesh.triangle([10, 0, 10], [20, 0, 10], [10, 10, 20], [1, 1, 1]));
  const [chunk] = mesh.build();
  assert.deepEqual([0, 1, 2].map((v) => chunk.mesh.colors[v * 4]), [0.5, 0.5, 1]);
});
