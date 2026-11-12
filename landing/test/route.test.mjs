import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadProfile } from "../src/lib/route.ts";

// Two tiny routes whose numbers can be checked by hand (see the files).
const fixtures = fileURLToPath(new URL("./fixtures/routes/", import.meta.url));

test("a profile reads the route from the directory it is given", () => {
  assert.equal(loadProfile("square", fixtures).name, "Square");
});

test("a profile measures the distance along the road, ignoring the height", () => {
  const profile = loadProfile("square", fixtures);
  assert.deepEqual(
    profile.samples.map(([d]) => d),
    [0, 300, 700, 1000],
  );
});

test("a profile keeps the elevation range for its vertical scale", () => {
  const profile = loadProfile("square", fixtures);
  assert.deepEqual([profile.minEle, profile.maxEle], [0, 10]);
});

test("a profile turns climbs and sprints into segments of the road", () => {
  assert.deepEqual(loadProfile("square", fixtures).segments, [
    { type: "climb", from: 300, to: 700 },
    { type: "sprint", from: 700, to: 900 },
  ]);
});
