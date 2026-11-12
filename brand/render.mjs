/**
 * GOindoor brand assets from one source: writes the SVG logos in brand/ and
 * renders every PNG icon the client, the landing page, the README and the
 * app use. Run from the repository root after changing the logo:
 *
 *   node brand/render.mjs            (needs client/node_modules: cd client && npm ci)
 *
 * Then `cd app && npm run assets` turns the new icon and emblem into the iOS
 * and Android icons and splash screens.
 *
 * Set PLAYWRIGHT_CHROMIUM=/path/to/chrome to use a Chromium other than
 * Playwright's own.
 *
 * The look follows the GD design system: the GD monogram in white, a near
 * black background with soft grey glows, glass cards (white at 9 % with a
 * 22 % border and a brighter top edge) and Helvetica Bold.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "../client/node_modules/playwright/index.mjs";

// --- palette (GD) -----------------------------------------------------------------

export const COLORS = {
  ink: "#0b0b0c", // background
  white: "#ffffff", // titles, the monogram
  silver: "#cfcfd4", // body text
  grey: "#8a8a8e", // glows, quiet text
  glowA: "#8a8a8e",
  glowB: "#6b6b70",
  glowC: "#5a5a5f",
  glass: "rgba(255, 255, 255, 0.09)",
  glassLine: "rgba(255, 255, 255, 0.22)",
  glassTop: "rgba(255, 255, 255, 0.4)",
};

const FONT = `Helvetica, 'Helvetica Neue', Arial, 'Liberation Sans', sans-serif`;

// --- the GD monogram -------------------------------------------------------------
// One closed shape: a rounded G and D sharing an outline. Its box is
// 59.93 × 37.04 units starting at (27.965, 28.422).

const GD_PATH =
  "M27.965 42.570C27.965 36.234 35.777 28.422 42.113 28.422L73.746 28.422C80.078 28.422 87.895 36.234 87.895 42.570" +
  "L87.895 51.313C87.895 57.645 80.078 65.461 73.746 65.461L66.430 65.461C65.504 65.461 64.363 64.320 64.363 63.395" +
  "L64.363 58.781C64.363 57.855 65.504 56.715 66.430 56.715L73.746 56.715C76.164 56.715 79.148 53.730 79.148 51.313" +
  "L79.148 42.570C79.148 40.148 76.164 37.164 73.746 37.164L42.113 37.164C39.695 37.164 36.711 40.148 36.711 42.570" +
  "L36.711 51.313C36.711 53.730 39.695 56.715 42.113 56.715L51.492 56.715C52.418 56.715 53.559 55.578 53.559 54.652" +
  "L53.559 53.375C53.559 52.453 52.418 51.313 51.492 51.313L45.207 51.313C44.285 51.313 43.145 50.172 43.145 49.250" +
  "L43.145 44.633C43.145 43.711 44.285 42.570 45.207 42.570L60.238 42.570C61.160 42.570 62.301 43.711 62.301 44.633" +
  "L62.301 63.395C62.301 64.320 61.160 65.461 60.238 65.461L42.113 65.461C35.777 65.461 27.965 57.645 27.965 51.313Z";
const GD_BOX = { x: 27.965, y: 28.422, w: 59.93, h: 37.039 };

/** The monogram scaled to `width`, centred on (cx, cy). */
function monogram({ cx, cy, width, color = COLORS.white }) {
  const s = width / GD_BOX.w;
  const x = cx - (GD_BOX.w * s) / 2 - GD_BOX.x * s;
  const y = cy - (GD_BOX.h * s) / 2 - GD_BOX.y * s;
  return `<path transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s.toFixed(4)})" fill="${color}" d="${GD_PATH}"/>`;
}

// --- the GO of the wordmark ---------------------------------------------------------
// "GO" built exactly like the GD monogram: one outline, the same G, its stem
// doubling as the O's left side, the top channel and the bottom slit kept. The
// D's bowl is widened to the G's width and its bottom-left hook rounded, which
// makes it an O. Box: 70.734 × 37.039 units from (27.965, 28.422), the baseline
// at y = 65.461.

const GO_PATH =
  "M27.965 42.570C27.965 36.234 35.777 28.422 42.113 28.422L84.551 28.422C90.887 28.422 98.699 36.234 98.699 42.5" +
  "70L98.699 51.313C98.699 57.649 90.887 65.461 84.551 65.461L73.109 65.461C69.193 65.461 64.363 60.631 64.363 56" +
  ".715L84.551 56.715C86.969 56.715 89.953 53.731 89.953 51.313L89.953 42.570C89.953 40.148 86.969 37.164 84.551 " +
  "37.164L42.113 37.164C39.695 37.164 36.711 40.148 36.711 42.570L36.711 51.313C36.711 53.730 39.695 56.715 42.11" +
  "3 56.715L51.492 56.715C52.418 56.715 53.559 55.578 53.559 54.652L53.559 53.375C53.559 52.453 52.418 51.313 51." +
  "492 51.313L45.207 51.313C44.285 51.313 43.145 50.172 43.145 49.250L43.145 44.633C43.145 43.711 44.285 42.570 4" +
  "5.207 42.570L60.238 42.570C61.160 42.570 62.301 43.711 62.301 44.633L62.301 63.395C62.301 64.320 61.160 65.461" +
  " 60.238 65.461L42.113 65.461C35.777 65.461 27.965 57.645 27.965 51.313Z";
export const GO_BOX = { x: 27.965, y: 28.422, w: 70.734, h: 37.039 };

/** The GO glyphs with their bottom on `baseline`, `height` tall, starting at x. */
function goGlyphs({ x, baseline, height, color = COLORS.white }) {
  const s = height / GO_BOX.h;
  const tx = x - GO_BOX.x * s;
  const ty = baseline - (GO_BOX.y + GO_BOX.h) * s;
  return `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})" fill="${color}" fill-rule="evenodd"><path d="${GO_PATH}"/></g>`;
}

// --- background and glass ---------------------------------------------------------

/** Near-black ground with the soft grey glows of the GD pages. */
function ground(w, h, { r = 0, id = "g" } = {}) {
  return `<defs>
    <radialGradient id="${id}a" cx="0.13" cy="0.07" r="0.75">
      <stop offset="0" stop-color="${COLORS.glowA}" stop-opacity="0.32"/>
      <stop offset="1" stop-color="${COLORS.glowA}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}b" cx="0.93" cy="0.5" r="0.55">
      <stop offset="0" stop-color="${COLORS.glowB}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${COLORS.glowB}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}c" cx="0.85" cy="0.95" r="0.5">
      <stop offset="0" stop-color="${COLORS.glowC}" stop-opacity="0.2"/>
      <stop offset="1" stop-color="${COLORS.glowC}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="${id}clip"><rect width="${w}" height="${h}" rx="${r}"/></clipPath>
  </defs>
  <g clip-path="url(#${id}clip)">
    <rect width="${w}" height="${h}" fill="${COLORS.ink}"/>
    <rect width="${w}" height="${h}" fill="url(#${id}a)"/>
    <rect width="${w}" height="${h}" fill="url(#${id}b)"/>
    <rect width="${w}" height="${h}" fill="url(#${id}c)"/>
  </g>`;
}

/** A glass card: white at 9 %, a 22 % outline and a brighter top edge. */
function glassCard({ x, y, w, h, r, line = 1.5 }) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${COLORS.glass}" stroke="${COLORS.glassLine}" stroke-width="${line}"/>
  <line x1="${x + r}" y1="${y + line / 2}" x2="${x + w - r}" y2="${y + line / 2}" stroke="${COLORS.glassTop}" stroke-width="${line}"/>`;
}

// --- wordmark ---------------------------------------------------------------------
// The GO glyphs, as tall as a capital, then "indoor" in Helvetica Bold (silver).

const CAP = 0.72; // Helvetica's cap height, in em
const INDOOR_EM = 2.93; // the width of "indoor" in Helvetica Bold at -0.03em spacing

/** Width of the wordmark at a font size, for centring. */
const wordmarkWidth = (size) => (GO_BOX.w / GO_BOX.h) * CAP * size + 0.06 * size + INDOOR_EM * size;

function wordmark({ x, y, size, anchor = "start" }) {
  const left = anchor === "middle" ? x - wordmarkWidth(size) / 2 : x;
  const glyphs = (GO_BOX.w / GO_BOX.h) * CAP * size;
  return `${goGlyphs({ x: left, baseline: y, height: CAP * size })}
  <text x="${(left + glyphs + 0.06 * size).toFixed(1)}" y="${y}" font-family="${FONT}" font-weight="700" font-size="${size}" letter-spacing="${(-size * 0.03).toFixed(1)}" fill="${COLORS.silver}">indoor</text>`;
}

/** Small uppercase label, spaced out, as on the GD pages. */
const label = ({ x, y, size, text, anchor = "start", fill = COLORS.silver }) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-weight="700" font-size="${size}" letter-spacing="${(size * 0.12).toFixed(1)}" fill="${fill}">${text}</text>`;

// --- the files --------------------------------------------------------------------

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}">
  <title>${title}</title>
  ${body}
</svg>
`;

/** The monogram alone, white on transparent. */
const MARK = svg(600, 371, monogram({ cx: 300, cy: 185.5, width: 600 }), "GD");

/** App icon: the monogram on the GD ground, rounded unless `bleed`. */
function icon(size, { bleed = false, scale = 0.62, id = "i" } = {}) {
  const r = bleed ? 0 : size * 0.22;
  return svg(size, size, `${ground(size, size, { r, id })}
  ${monogram({ cx: size / 2, cy: size / 2, width: size * scale })}`, "GOindoor");
}

/** Monogram beside the wordmark, transparent background (for dark pages). */
const LOGO = svg(
  1200,
  300,
  `${monogram({ cx: 150, cy: 150, width: 240 })}
  ${wordmark({ x: 320, y: 196, size: 150 })}`,
  "GOindoor",
);

/** README and splash emblem: a glass card with the monogram over the wordmark. */
const EMBLEM = svg(
  640,
  560,
  `${ground(640, 560, { r: 72, id: "e" })}
  ${glassCard({ x: 40, y: 40, w: 560, h: 480, r: 40, line: 2 })}
  ${monogram({ cx: 320, cy: 215, width: 300 })}
  ${wordmark({ x: 320, y: 420, size: 104, anchor: "middle" })}
  ${label({ x: 320, y: 470, size: 22, text: "INDOOR CYCLING", anchor: "middle" })}`,
  "GOindoor",
);

/** Open Graph card for link previews (1200 × 630). */
function ogImage(heroDataUrl) {
  return svg(
    1200,
    630,
    `<defs>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0.25" stop-color="${COLORS.ink}" stop-opacity="1"/>
      <stop offset="0.7" stop-color="${COLORS.ink}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${COLORS.ink}" stop-opacity="0.25"/>
    </linearGradient>
    <filter id="grey"><feColorMatrix type="saturate" values="0.15"/></filter>
  </defs>
  ${ground(1200, 630, { id: "o" })}
  <image href="${heroDataUrl}" x="360" y="0" width="1120" height="630" preserveAspectRatio="xMidYMid slice" filter="url(#grey)" opacity="0.9"/>
  <rect width="1200" height="630" fill="url(#fade)"/>
  ${glassCard({ x: 60, y: 70, w: 780, h: 490, r: 28, line: 2 })}
  ${monogram({ cx: 175, cy: 175, width: 150 })}
  ${label({ x: 280, y: 184, size: 20, text: "OPEN SOURCE" })}
  ${wordmark({ x: 100, y: 330, size: 120 })}
  <line x1="100" y1="372" x2="800" y2="372" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
  <text x="100" y="430" font-family="${FONT}" font-weight="700" font-size="40" fill="${COLORS.white}">Indoor cycling in your browser.</text>
  <text x="100" y="486" font-family="${FONT}" font-weight="400" font-size="30" fill="${COLORS.silver}">Free and open source. Ride with friends and bots.</text>`,
    "GOindoor: indoor cycling in your browser",
  );
}

// --- render -----------------------------------------------------------------------

const write = (path, text) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  console.log("wrote", path);
};

write("brand/goindoor-mark.svg", MARK);
write("brand/goindoor-icon.svg", icon(512));
write("brand/goindoor-logo.svg", LOGO);
write("brand/goindoor-emblem.svg", EMBLEM);

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const page = await browser.newPage({ deviceScaleFactor: 1 });

/** Renders an SVG string to a PNG of exactly width × height pixels. */
async function png(path, svgText, width, height, { transparent = true } = {}) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${width}px;height:${height}px}</style>${svgText}`,
  );
  await page.evaluate(() => document.fonts.ready);
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, omitBackground: transparent, clip: { x: 0, y: 0, width, height } });
  console.log("rendered", path);
}

const favicon = icon(64, { scale: 0.74, id: "f" });

for (const dir of ["client/public/icons", "landing/public/icons"]) {
  await png(`${dir}/favicon-32.png`, favicon, 32, 32);
  await png(`${dir}/favicon-64.png`, favicon, 64, 64);
  // iOS rounds the corners itself.
  await png(`${dir}/apple-touch-icon.png`, icon(180, { bleed: true, scale: 0.6, id: "a" }), 180, 180, { transparent: false });
  // Shown at 65 × 40 (client) and 49 × 30 (landing) CSS pixels.
  await png(`${dir}/brand-mark.png`, MARK, 194, 120);
}
await png("client/public/icons/icon-192.png", icon(192, { id: "s" }), 192, 192);
await png("client/public/icons/icon-512.png", icon(512, { id: "l" }), 512, 512);
// Maskable: everything inside the central safe circle (80 % of the size).
await png("client/public/icons/icon-maskable-512.png", icon(512, { bleed: true, scale: 0.56, id: "m" }), 512, 512, { transparent: false });
await png("docs/assets/goindoor-emblem.png", EMBLEM, 640, 560);

const hero = readFileSync("landing/src/assets/hero.png").toString("base64");
await png("landing/public/og.png", ogImage(`data:image/png;base64,${hero}`), 1200, 630, { transparent: false });

await browser.close();
