// Checks on the built site in dist/. They hold for every build setting, so
// they run on whatever `npm run build` produced last; without a build they
// are skipped (`make test-landing` builds first).

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const skip = existsSync(`${dist}index.html`) ? false : "no build in landing/dist: run npm run build first";

const read = (path) => readFileSync(dist + path, "utf8");
const pages = ["index.html", "404.html", "changelog/index.html"];

/** The base path every link is built on, from the home page's canonical link. */
function basePath() {
  const canonical = read("index.html").match(/<link rel="canonical" href="([^"]+)"/)[1];
  return new URL(canonical).pathname;
}

/** Every same-site URL in a page: root-relative href, src and srcset entries. */
function sameSiteUrls(html) {
  const urls = [...html.matchAll(/\s(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
  for (const [, srcset] of html.matchAll(/\ssrcset="([^"]*)"/g)) {
    urls.push(...srcset.split(",").map((candidate) => candidate.trim().split(/\s+/)[0]));
  }
  return urls.filter((url) => url.startsWith("/"));
}

test("every link and image stays under the base path", { skip }, () => {
  const base = basePath();
  for (const page of pages) {
    const outside = sameSiteUrls(read(page)).filter((url) => !url.startsWith(base));
    assert.deepEqual(outside, [], `${page} links outside ${base}`);
  }
});

test("a wake-up request only ever goes to the server's health check", { skip }, () => {
  const targets = [...read("index.html").matchAll(/\sdata-wake="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(
    targets.filter((url) => !/^https?:\/\/[^/]+\/healthz$/.test(url)),
    [],
  );
});
