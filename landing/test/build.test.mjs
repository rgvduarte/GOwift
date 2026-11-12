// Checks on the built site in dist/. They hold for every build setting, so
// they run on whatever `npm run build` produced last; without a build they
// are skipped (`make test-landing` builds first).

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const skip = existsSync(`${dist}index.html`) ? false : "no build in landing/dist: run npm run build first";

const read = (path) => readFileSync(dist + path, "utf8");
const pages = ["index.html", "404.html", "changelog/index.html"];

/** All CSS of the site: the bundled files and what Astro inlined into pages. */
function allCss() {
  const files = readdirSync(`${dist}_astro`).filter((name) => name.endsWith(".css"));
  const inline = pages.flatMap((page) => [...read(page).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]));
  return [...files.map((name) => read(`_astro/${name}`)), ...inline].join("\n");
}

/**
 * Every animation and transition declaration in `css`, with the selectors and
 * at-rules around it, e.g. "@media (...) > .button { transition: ... }".
 * Keyframes are left out: they only describe a motion that a rule starts.
 */
function motionRules(css) {
  const stack = [];
  const found = [];
  let text = "";
  const declaration = () => {
    const property = text.trim().match(/^([a-z-]+)\s*:/)?.[1];
    if (property && /^(animation|transition)(-|$)/.test(property) && !stack.some((p) => p.startsWith("@keyframes"))) {
      found.push({ context: [...stack], rule: `${stack.join(" > ")} { ${text.trim()} }` });
    }
    text = "";
  };
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (ch === "{") {
      stack.push(text.trim());
      text = "";
    } else if (ch === "}") {
      declaration();
      stack.pop();
    } else if (ch === ";") declaration();
    else text += ch;
  }
  return found;
}

const allowsMotion = (context) => context.some((p) => /prefers-reduced-motion\s*:\s*no-preference/.test(p));

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

test("the page states the facts of the routes the server loads", { skip }, async () => {
  const { routeStats } = await import("../src/lib/route.ts");
  const { routeFacts } = await import("../src/lib/facts.ts");
  const html = read("index.html");
  const facts = routeFacts(routeStats(fileURLToPath(new URL("../../routes/", import.meta.url))));
  assert.deepEqual(
    facts.filter((fact) => !html.includes(`>${fact.value}<`)),
    [],
  );
});

test("the hero leads to how it works, and hosting keeps its own section", { skip }, () => {
  const html = read("index.html");
  const hero = html.match(/<section[^>]*class="hero[\s\S]*?<\/section>/)[0];
  assert.deepEqual(
    [hero.includes('href="#how"'), html.includes('id="how"'), html.includes('id="host"')],
    [true, true, true],
  );
});

test("the hero asks for the width its cover crop needs, which on a tall screen depends on the height", { skip }, () => {
  const img = read("index.html").match(/<img[^>]*class="hero-shot"[^>]*>/)[0];
  assert.match(img.match(/sizes="([^"]*)"/)[1], /\d+vh/);
});

test("the hero offers no image wider than its source file", { skip }, () => {
  const html = read("index.html");
  const img = html.match(/<img[^>]*class="hero-shot"[^>]*>/)[0];
  const source = Number(img.match(/width="(\d+)"/)[1]);
  const picture = html.slice(html.lastIndexOf("<picture", html.indexOf(img)), html.indexOf(img));
  const widths = [...(picture + img).matchAll(/\s(\d+)w[,"]/g)].map((m) => Number(m[1]));
  assert.deepEqual(
    widths.filter((w) => w > source),
    [],
  );
});

test("no background is fixed to the viewport (iOS ignores it, low-end Android repaints it on scroll)", { skip }, () => {
  assert.doesNotMatch(allCss(), /background-attachment\s*:\s*fixed/);
});

test("nothing moves for visitors who asked their system to reduce motion", { skip }, () => {
  assert.deepEqual(
    motionRules(allCss())
      .filter(({ context }) => !allowsMotion(context))
      .map(({ rule }) => rule),
    [],
  );
});

test("the route profile draws itself for visitors who allow motion", { skip }, () => {
  const drawing = motionRules(allCss()).filter(
    ({ context, rule }) => allowsMotion(context) && /\.trace/.test(context.at(-1)) && /animation/.test(rule),
  );
  assert.equal(drawing.length > 0, true);
});

test("a wake-up request only ever goes to the server's health check", { skip }, () => {
  const targets = [...read("index.html").matchAll(/\sdata-wake="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(
    targets.filter((url) => !/^https?:\/\/[^/]+\/healthz$/.test(url)),
    [],
  );
});
