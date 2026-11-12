import { test } from "node:test";
import assert from "node:assert/strict";
import { copyText } from "../src/lib/copy.ts";

test("copying puts the text on the clipboard", async () => {
  const written = [];
  await copyText("make up", { writeText: async (text) => written.push(text) });
  assert.deepEqual(written, ["make up"]);
});

test("copying reports success", async () => {
  assert.equal(await copyText("make up", { writeText: async () => {} }), true);
});

test("without a clipboard copying reports failure, so the page can select the text instead", async () => {
  assert.equal(await copyText("make up", undefined), false);
});

test("a refused clipboard reports failure instead of throwing", async () => {
  const clipboard = {
    writeText: async () => {
      throw new DOMException("denied", "NotAllowedError");
    },
  };
  assert.equal(await copyText("make up", clipboard), false);
});
