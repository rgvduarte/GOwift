// Checks on how .github/workflows/pages.yml builds the public page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../.github/workflows/pages.yml", import.meta.url), "utf8");

/** The build setting `name` as the workflow passes it, e.g. "${{ vars.X || 'true' }}", or null. */
const setting = (name) => workflow.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, "m"))?.[1].trim() ?? null;

// The wake-up request shows every visitor's IP address to the game server's
// host before they click (ADR 0025): the operator turns it on, after their
// privacy policy says so.
test("the public page sends no wake-up request unless a repository variable turns it on", () => {
  assert.match(setting("PUBLIC_APP_PREWARM"), /^\$\{\{\s*vars\.\w+\s*(\|\|\s*'false'\s*)?\}\}$/);
});

test("the public page links the privacy policy and imprint that repository variables name", () => {
  assert.deepEqual(
    [setting("PUBLIC_PRIVACY_URL"), setting("PUBLIC_IMPRINT_URL")].map((value) => /^\$\{\{\s*vars\.\w+/.test(value)),
    [true, true],
  );
});
