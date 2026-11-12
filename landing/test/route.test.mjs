import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadProfile, routeStats } from "../src/lib/route.ts";

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
