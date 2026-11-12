import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadProfile, routeStats, simplifyProfile } from "../src/lib/route.ts";

// Two tiny loops whose numbers can be checked by hand (see the files):
// square.json: 300 + 400 + 300 m, then 400 m back to the start; it rises 10 m.
// line.json: 1000 m out and 1000 m back; it rises 30 m.
const fixtures = fileURLToPath(new URL("./fixtures/routes/", import.meta.url));

test("a profile reads the route from the directory it is given", () => {
  assert.equal(loadProfile("square", fixtures).name, "Square");
});

test("a profile covers the whole lap, back to the start, as in the game", () => {
  const profile = loadProfile("square", fixtures);
  assert.deepEqual(
    profile.samples.map(([d]) => d),
    [0, 300, 700, 1000, 1400],
  );
});

test("a profile measures the distance along the road, ignoring the height", () => {
  assert.equal(loadProfile("square", fixtures).lengthM, 1400);
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

test("the route stats count every route file in the directory", () => {
  assert.equal(routeStats(fixtures).routes, 2);
});

test("the route stats add up one lap of each route, closing segment included", () => {
  assert.equal(routeStats(fixtures).lengthM, 3400);
});

test("the route stats add up the climbing as the sum of every rise", () => {
  assert.equal(routeStats(fixtures).climbM, 40);
});

test("the route stats name the longest route", () => {
  assert.deepEqual(routeStats(fixtures).longest, { name: "Line", lengthM: 2000 });
});

// A long, wavy road with one sharp peak and one dip, sampled every metre.
const wavy = Array.from({ length: 2000 }, (_, d) => [d, 100 + 20 * Math.sin(d / 50)]);
wavy[1234][1] = 400;
wavy[777][1] = -50;

test("a simplified profile keeps the start and the finish", () => {
  const simple = simplifyProfile(wavy, 100);
  assert.deepEqual([simple[0], simple.at(-1)], [wavy[0], wavy.at(-1)]);
});

test("a simplified profile keeps the highest and the lowest point", () => {
  const simple = simplifyProfile(wavy, 100);
  assert.deepEqual(
    [simple.some(([d]) => d === 1234), simple.some(([d]) => d === 777)],
    [true, true],
  );
});

test("a simplified profile has at most two points per bucket, plus the ends", () => {
  assert.ok(simplifyProfile(wavy, 100).length <= 202);
});

test("a simplified profile stays in order along the road", () => {
  const distances = simplifyProfile(wavy, 100).map(([d]) => d);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
});

test("a profile with fewer points than buckets stays as it is", () => {
  const short = wavy.slice(0, 50);
  assert.deepEqual(simplifyProfile(short, 100), short);
});
