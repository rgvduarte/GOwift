import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The header draws the GD monogram inline (one request less, sharp on every
// screen). It must stay the very mark in brand/, which is the source of truth.
const source = readFileSync(new URL("../../brand/goindoor-mark.svg", import.meta.url), "utf8");
const inline = readFileSync(new URL("../src/components/GdMark.astro", import.meta.url), "utf8");

const shape = (svg) => ({
  viewBox: svg.match(/viewBox="([^"]+)"/)[1],
  transform: svg.match(/transform="([^"]+)"/)[1],
  d: svg.match(/\sd="([^"]+)"/)[1],
});

test("the header's monogram is the GD mark from brand/, unchanged", () => {
  assert.deepEqual(shape(inline), shape(source));
});
