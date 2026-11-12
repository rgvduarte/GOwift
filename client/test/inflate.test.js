import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFLATE_RAW, canInflate, createInflater } from "../public/js/net/inflate.js";
import { deflateRawFrames } from "./helpers.js";

/** Collects the inflater's messages; `next()` waits for the n-th one. */
function collector() {
  const texts = [];
  let wake = () => {};
  return {
    texts,
    push: (text) => {
      texts.push(text);
      wake();
    },
    async waitFor(count) {
      while (texts.length < count) await new Promise((resolve) => (wake = resolve));
    },
  };
}

test("this runtime can inflate deflate-raw frames", () => {
  assert.equal(canInflate(), true);
});

test("a browser without DecompressionStream can't inflate", () => {
  assert.equal(canInflate(null), false);
});

test("a browser whose DecompressionStream refuses deflate-raw can't inflate", () => {
  class OnlyGzip {
    constructor(format) {
      if (format !== "gzip") throw new TypeError(`unsupported ${format}`);
    }
  }
  assert.equal(canInflate(OnlyGzip), false);
});

test("names the format the server sends", () => {
  assert.equal(DEFLATE_RAW, "deflate-raw");
});

test("each frame inflates to its message, in order, on one stream", async () => {
  const deflate = deflateRawFrames();
  const out = collector();
  const inflater = createInflater(out.push);
  const states = [1, 2, 3].map((tick) => ({ type: "state", tick, riders: [{ id: 4, name: "Jürgen Wälti" }] }));
  for (const state of states) inflater.push(await deflate(state));
  await out.waitFor(3);
  assert.deepEqual(out.texts.map((text) => JSON.parse(text)), states);
});

test("later frames are smaller: they refer back to earlier ones", async () => {
  const deflate = deflateRawFrames();
  const state = { type: "state", tick: 1, riders: [{ id: 4, name: "Femke Sprintwell", team: "lavendel" }] };
  const first = await deflate(state);
  const second = await deflate(state);
  assert.ok(second.byteLength * 2 < first.byteLength, `${first.byteLength} B then ${second.byteLength} B`);
  const out = collector();
  const inflater = createInflater(out.push);
  inflater.push(first);
  inflater.push(second);
  await out.waitFor(2);
  assert.equal(out.texts[1], JSON.stringify(state));
});

test("drained waits until every pushed frame is delivered", async () => {
  const deflate = deflateRawFrames();
  const out = collector();
  const inflater = createInflater(out.push);
  inflater.push(await deflate({ type: "state", tick: 1 }));
  inflater.push(await deflate({ type: "error", code: "afk_timeout" }));
  await inflater.drained();
  assert.equal(out.texts.length, 2);
});

test("drained is immediate when nothing is pending", async () => {
  const inflater = createInflater(() => {});
  await inflater.drained();
});

test("an error in a message handler doesn't stop later messages", async () => {
  const deflate = deflateRawFrames();
  const texts = [];
  const reported = [];
  const inflater = createInflater(
    (text) => {
      texts.push(text);
      if (texts.length === 1) throw new Error("render bug");
    },
    { report: (error) => reported.push(error.message) },
  );
  inflater.push(await deflate({ type: "state", tick: 1 }));
  inflater.push(await deflate({ type: "state", tick: 2 }));
  await inflater.drained();
  assert.equal(texts.length, 2);
  assert.deepEqual(reported, ["render bug"]);
});

test("corrupt data fails once and leaves nothing pending", async () => {
  const failures = [];
  const inflater = createInflater(() => {}, { onError: (error) => failures.push(error) });
  inflater.push(new Uint8Array([0xff, 0xff, 0xff, 0xff]).buffer);
  inflater.push(new Uint8Array([0xff, 0xff]).buffer);
  await inflater.drained();
  assert.equal(failures.length, 1);
});
