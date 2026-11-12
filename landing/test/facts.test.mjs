import { test } from "node:test";
import assert from "node:assert/strict";
import { routeFacts } from "../src/lib/facts.ts";

const stats = {
  routes: 9,
  lengthM: 286544.5,
  climbM: 4137.9,
  longest: { name: "Lanzarote Lava 180", lengthM: 179570.1 },
};

const values = () => routeFacts(stats).map((fact) => fact.value);

test("the facts state the number of routes", () => {
  assert.equal(values()[0], "9");
});

test("the facts round the total length to whole kilometres", () => {
  assert.equal(values()[1], "287 km");
});

test("the facts give the climbing in metres with a thousands separator", () => {
  assert.equal(values()[2], "4,138 m");
});

test("the facts name the longest route with its length", () => {
  const longest = routeFacts(stats)[3];
  assert.deepEqual([longest.value, longest.label.includes("Lanzarote Lava 180")], ["180 km", true]);
});
