import { test } from "node:test";
import assert from "node:assert/strict";
import { appHostOf, startLabel } from "../src/lib/app.ts";

test("with a public server the main button invites riders to start", () => {
  assert.equal(startLabel(true), "Start riding free");
});

test("without a public server the main button leads to getting started", () => {
  assert.equal(startLabel(false), "Get started");
});

test("the main button stays short enough for one line on a small phone", () => {
  for (const hasApp of [true, false]) assert.ok(startLabel(hasApp).length <= 24);
});

test("the server's host is its address without the scheme or a trailing slash", () => {
  assert.equal(appHostOf("https://goindoor.onrender.com/"), "goindoor.onrender.com");
});

test("a server without an address has no host", () => {
  assert.equal(appHostOf(""), "");
});
