/**
 * GOwift brand assets from one source: writes the SVG logos in brand/ and
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
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "../client/node_modules/playwright/index.mjs";

// --- palette ----------------------------------------------------------------------

export const COLORS = {
  go: "#2ee88a", // GO green: the brand colour
  goLight: "#7dffbe",
  goDeep: "#0fb866",
  ink: "#080a0e", // icon and splash background
  white: "#ffffff",
};

// --- the mark -----------------------------------------------------------------------
// A tyre shaped like a G (open at the top right, its bar pointing in) with
// three speed lines, leaning forward 10°. Drawn in a 512 × 400 box around
// the wheel's centre (308, 200).

const gradient = (id) => `
    <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="180" y1="70" x2="440" y2="330">
      <stop offset="0" stop-color="${COLORS.goLight}"/>
      <stop offset="0.55" stop-color="${COLORS.go}"/>
      <stop offset="1" stop-color="${COLORS.goDeep}"/>
    </linearGradient>`;

const G_PATHS = (id) => `
    <path d="M391.6 100.4 A130 130 0 1 0 438 200" stroke="url(#${id})" stroke-width="58"/>
    <path d="M438 200 H322" stroke="url(#${id})" stroke-width="58"/>`;

const SPEED_LINES = `
    <path d="M64 140 H128" stroke="${COLORS.go}" stroke-width="28" opacity="0.55"/>
    <path d="M28 200 H118" stroke="${COLORS.go}" stroke-width="28"/>
    <path d="M64 260 H128" stroke="${COLORS.go}" stroke-width="28" opacity="0.55"/>`;

/** The mark as SVG elements in its 512 × 400 box (no <svg> wrapper). */
function markBody(id, { lines = true } = {}) {
  return `<defs>${gradient(id)}
  </defs>
  <g transform="translate(0 200) skewX(-10) translate(0 -200)" fill="none" stroke-linecap="round">${lines ? SPEED_LINES : ""}${G_PATHS(id)}
  </g>`;
}

// Tight boxes around the drawn shapes (after the lean), for placing the mark.
const MARK_BOX = { x: 4, y: 16, w: 474, h: 368 }; // with speed lines
const G_BOX = { x: 139, y: 31, w: 338, h: 338 }; // the G alone

/** Places the mark, scaled to `width`, centred on (cx, cy) of the parent. */
function placeMark(id, { cx, cy, width, lines = true }) {
  const box = lines ? MARK_BOX : G_BOX;
  const s = width / box.w;
  const x = cx - (box.w * s) / 2 - box.x * s;
  const y = cy - (box.h * s) / 2 - box.y * s;
  return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s.toFixed(4)})">${markBody(id, { lines })}</g>`;
}

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}">
  <title>${title}</title>
  ${body}
</svg>
`;

// --- wordmark ---------------------------------------------------------------------
// "GO" in green, "wift" in white, heavy and leaning like the mark. Text, so it
// needs the font where it is shown; the PNGs are rendered with Inter Display.

const FONT = `'Inter Display', Inter, 'Segoe UI', system-ui, sans-serif`;
const wordmark = ({ x, y, size, anchor = "start" }) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-weight="900" font-size="${size}" letter-spacing="${(-size * 0.02).toFixed(1)}" transform="translate(${(y * 0.176).toFixed(1)} 0) skewX(-10)"><tspan fill="${COLORS.go}">GO</tspan><tspan fill="${COLORS.white}">wift</tspan></text>`;

// --- the files --------------------------------------------------------------------

const MARK = svg(MARK_BOX.w, MARK_BOX.h, `<g transform="translate(${-MARK_BOX.x} ${-MARK_BOX.y})">${markBody("go")}</g>`, "GOwift");

/** App icon: the mark on a dark square, rounded unless `bleed`. */
function icon(size, { bleed = false, lines = true, scale = 0.78 } = {}) {
  const r = bleed ? 0 : size * 0.22;
  const width = size * scale;
  return svg(
    size,
    size,
    `<rect width="${size}" height="${size}" rx="${r}" fill="${COLORS.ink}"/>
  ${placeMark("go", { cx: size / 2, cy: size / 2, width, lines })}`,
    "GOwift",
  );
}

/** Mark beside the wordmark, on a transparent background (dark pages). */
const LOGO = svg(
  1200,
  300,
  `${placeMark("go", { cx: 190, cy: 150, width: 330 })}
  ${wordmark({ x: 380, y: 205, size: 170 })}`,
  "GOwift",
);

/** README and splash emblem: mark over the wordmark on a dark rounded badge. */
const EMBLEM = svg(
  640,
  560,
  `<rect width="640" height="560" rx="72" fill="${COLORS.ink}"/>
  ${placeMark("go", { cx: 320, cy: 215, width: 400 })}
  ${wordmark({ x: 300, y: 470, size: 132, anchor: "middle" })}`,
  "GOwift",
);

/** Open Graph card for link previews (1200 × 630). */
function ogImage(heroDataUrl) {
  return svg(
    1200,
    630,
    `<defs>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0.3" stop-color="${COLORS.ink}" stop-opacity="1"/>
      <stop offset="0.75" stop-color="${COLORS.ink}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${COLORS.ink}" stop-opacity="0.1"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="${COLORS.ink}"/>
  <image href="${heroDataUrl}" x="300" y="0" width="1120" height="630" preserveAspectRatio="xMidYMid slice"/>
  <rect width="1200" height="630" fill="url(#fade)"/>
  ${placeMark("go", { cx: 190, cy: 250, width: 250 })}
  ${wordmark({ x: 340, y: 300, size: 150 })}
  <text x="80" y="430" font-family="${FONT}" font-weight="700" font-size="46" fill="${COLORS.white}">Indoor cycling in your browser.</text>
  <text x="80" y="492" font-family="${FONT}" font-weight="500" font-size="34" fill="#b8c2cf">Free and open source. Ride with friends and bots.</text>
  <rect x="80" y="540" width="120" height="8" rx="4" fill="${COLORS.go}"/>`,
    "GOwift: indoor cycling in your browser",
  );
}

// --- render -----------------------------------------------------------------------

const write = (path, text) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  console.log("wrote", path);
};

write("brand/gowift-mark.svg", MARK);
write("brand/gowift-icon.svg", icon(512));
write("brand/gowift-logo.svg", LOGO);
write("brand/gowift-emblem.svg", EMBLEM);

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

const favicon = icon(64, { lines: false, scale: 0.8 });
const BRAND_MARK = svg(MARK_BOX.w, MARK_BOX.h, `<g transform="translate(${-MARK_BOX.x} ${-MARK_BOX.y})">${markBody("go")}</g>`, "GOwift");

for (const dir of ["client/public/icons", "landing/public/icons"]) {
  await png(`${dir}/favicon-32.png`, favicon, 32, 32);
  await png(`${dir}/favicon-64.png`, favicon, 64, 64);
  // iOS rounds the corners itself.
  await png(`${dir}/apple-touch-icon.png`, icon(180, { bleed: true, scale: 0.74 }), 180, 180, { transparent: false });
  // Shown at 69 × 54 (client) and 46 × 36 (landing) CSS pixels.
  await png(`${dir}/brand-mark.png`, BRAND_MARK, 139, 108);
}
await png("client/public/icons/icon-192.png", icon(192), 192, 192);
await png("client/public/icons/icon-512.png", icon(512), 512, 512);
// Maskable: everything inside the central safe circle (80 % of the size).
await png("client/public/icons/icon-maskable-512.png", icon(512, { bleed: true, scale: 0.66 }), 512, 512, { transparent: false });
await png("docs/assets/gowift-emblem.png", EMBLEM, 640, 560);

const hero = readFileSync("landing/src/assets/hero.png").toString("base64");
await png("landing/public/og.png", ogImage(`data:image/png;base64,${hero}`), 1200, 630, { transparent: false });

await browser.close();
