import { test } from "node:test";
import assert from "node:assert/strict";
import { createWake, prewarmUrl } from "../src/lib/prewarm.ts";

/** A fetch that records its calls and answers with `result`. */
function fakeFetch(result = () => Promise.resolve({})) {
  const calls = [];
  const fetch = (url, init) => {
    calls.push({ url, init });
    return result();
  };
  return { fetch, calls };
}

const healthz = "https://goindoor.onrender.com/healthz";

test("the wake-up request goes to the server's health check", () => {
  assert.equal(prewarmUrl("https://goindoor.onrender.com"), healthz);
});

test("a trailing slash on the server's address makes no difference", () => {
  assert.equal(prewarmUrl("https://goindoor.onrender.com/"), healthz);
});

test("without a server there is nothing to wake", () => {
  assert.equal(prewarmUrl(""), null);
});

test("only a web server is woken", () => {
  assert.equal(prewarmUrl("#host"), null);
});

test("waking sends one request the page cannot read, so the server needs no CORS", () => {
  const { fetch, calls } = fakeFetch();
  createWake(healthz, { fetch })();
  assert.deepEqual(
    calls.map(({ url, init }) => [url, init.mode]),
    [[healthz, "no-cors"]],
  );
});

test("waking sends no cookies and no referrer", () => {
  const { fetch, calls } = fakeFetch();
  createWake(healthz, { fetch })();
  assert.deepEqual([calls[0].init.credentials, calls[0].init.referrerPolicy], ["omit", "no-referrer"]);
});

test("waking more than once still sends a single request", () => {
  const { fetch, calls } = fakeFetch();
  const wake = createWake(healthz, { fetch });
  wake();
  wake();
  wake();
  assert.equal(calls.length, 1);
});

test("a visitor who asked to save data is never woken for", () => {
  const { fetch, calls } = fakeFetch();
  createWake(healthz, { fetch, connection: { saveData: true } })();
  assert.equal(calls.length, 0);
});

test("without an address waking does nothing", () => {
  const { fetch, calls } = fakeFetch();
  createWake(null, { fetch })();
  assert.equal(calls.length, 0);
});

test("a failed request is ignored, so the page never fails because of it", async () => {
  const { fetch } = fakeFetch(() => Promise.reject(new TypeError("network down")));
  createWake(healthz, { fetch })();
  // An unhandled rejection would fail this test file.
  await new Promise((resolve) => setImmediate(resolve));
});

test("a fetch that throws at once is ignored too", () => {
  const fetch = () => {
    throw new TypeError("blocked");
  };
  assert.doesNotThrow(() => createWake(healthz, { fetch })());
});
