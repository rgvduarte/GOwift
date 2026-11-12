/**
 * Ride photos: snapshots of the world with a small stats overlay, and a
 * summary card for the end of the ride. Both are drawn on a 2D canvas (no
 * DOM screenshot), so they look the same on every device and are ready to
 * attach to a Strava activity. The browser keeps them in memory until the
 * page is closed; the finish dialog lists them for download or sharing.
 */

import { formatDistanceWithUnit, formatDuration, formatNumber, formatSpeed, speedUnit } from "../util/format.js";
import { getLocale, t } from "../i18n/i18n.js";
import { GD_BOX, GD_PATH, GO_BOX, GO_PATH, fillMark } from "./brandMarks.js";
import { coastOutline, islandOf, mapFrame, roadSamples } from "./mapPreview.js";

export const MAX_PHOTOS = 30;
// The GD design system: Helvetica, white on near black, glass cards.
const SANS = 'Helvetica, "Helvetica Neue", Arial, system-ui, sans-serif'; // i18n-ok
const NUM = SANS;
const ACCENT = "#ffffff";
const INK = "#0b0b0c";
const SILVER = "#cfcfd4";
const GREY = "#8a8a8e";

/** "goindoor-2026-10-14-1530-rolling-hills-3.png" */
export function photoFileName(t, routeId = "ride", suffix = "") {
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, "0");
  const safe = String(routeId).replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "ride";
  const tail = suffix === "" ? "" : `-${suffix}`;
  return `goindoor-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}-${safe}${tail}.png`;
}

/**
 * The photos taken during one ride, oldest first. Holds blobs plus object
 * URLs for the thumbnails; the oldest photo is dropped beyond `max`.
 */
export class PhotoAlbum {
  /** @type {{id: number, blob: Blob, url: string, name: string, takenAt: number}[]} */
  photos = [];
  /** The ride's summary card, regenerated whenever the finish dialog opens. */
  summary = null;
  #nextId = 1;

  /** @param {{max?: number, createUrl?: (blob: Blob) => string, revokeUrl?: (url: string) => void}} [options] */
  constructor({ max = MAX_PHOTOS, createUrl = (blob) => URL.createObjectURL(blob), revokeUrl = (url) => URL.revokeObjectURL(url) } = {}) {
    this.max = max;
    this.createUrl = createUrl;
    this.revokeUrl = revokeUrl;
  }

  /** Number of photos taken (the summary image doesn't count). */
  get size() {
    return this.photos.length;
  }

  /** Everything to download or share: the summary first, then the photos. */
  get images() {
    return this.summary ? [this.summary, ...this.photos] : [...this.photos];
  }

  setSummary(blob, { name, takenAt = Date.now() }) {
    if (this.summary) this.revokeUrl(this.summary.url);
    this.summary = { id: 0, blob, url: this.createUrl(blob), name, takenAt, summary: true };
    return this.summary;
  }

  add(blob, { name, takenAt = Date.now() }) {
    const photo = { id: this.#nextId++, blob, url: this.createUrl(blob), name, takenAt };
    this.photos.push(photo);
    while (this.photos.length > this.max) this.revokeUrl(this.photos.shift().url);
    return photo;
  }

  remove(id) {
    const index = this.photos.findIndex((photo) => photo.id === id);
    if (index < 0) return false;
    this.revokeUrl(this.photos[index].url);
    this.photos.splice(index, 1);
    return true;
  }

  /** Drops every photo and the summary card, e.g. when a new ride starts. */
  clear() {
    for (const image of this.images) this.revokeUrl(image.url);
    this.photos = [];
    this.summary = null;
  }
}

/** Keep the summary save action distinct from the optional collection of photos. */
export function photoActions(album, shareable) {
  return {
    summaryEnabled: Boolean(album.summary),
    allVisible: album.photos.length > 0,
    shareVisible: shareable && album.images.length > 0,
  };
}

/** The stats shown on an in-ride photo, in display order. */
export function photoStats({ distanceM, elapsedS, power, speed, gradePercent }) {
  return [
    [t("photos.stat.distance"), formatDistanceWithUnit(distanceM)],
    [t("photos.stat.time"), formatDuration(elapsedS)],
    [t("photos.stat.power"), `${Math.round(power || 0)} W`],
    [t("photos.stat.speed"), `${formatSpeed(speed || 0)} ${speedUnit()}`],
    [t("photos.stat.grade"), `${gradePercent >= 0 ? "" : "−"}${formatNumber(Math.abs(gradePercent || 0), 1)} %`],
  ];
}

/**
 * Splits values into `count` buckets and averages each; used to draw the
 * power and elevation lines of a long ride on a small chart.
 * @param {number[]} values
 */
export function downsample(values, count) {
  if (values.length <= count) return [...values];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const from = Math.floor((i * values.length) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * values.length) / count));
    let sum = 0;
    for (let j = from; j < to; j += 1) sum += values[j];
    out.push(sum / (to - from));
  }
  return out;
}

/**
 * Copies the visible world into a new canvas. Call it in the same frame as
 * the WebGL render: without preserveDrawingBuffer the buffer is cleared once
 * the browser has shown it.
 * @param {HTMLCanvasElement} source
 */
export function grabScene(source, doc = document) {
  const canvas = doc.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext("2d").drawImage(source, 0, 0);
  return canvas;
}

/**
 * Draws a ride photo: the scene with a stats band along the bottom.
 * @param {HTMLCanvasElement} scene from grabScene
 * @param {{routeName: string, stats: [string, string][], when: Date}} info
 */
export function composePhoto(scene, { routeName, stats, when }, doc = document) {
  const canvas = doc.createElement("canvas");
  canvas.width = scene.width;
  canvas.height = scene.height;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.drawImage(scene, 0, 0);

  const u = Math.max(w, h * 1.6) / 1280; // layout unit, 1 at 1280 px wide
  const band = 92 * u;
  const fade = ctx.createLinearGradient(0, h - band * 1.8, 0, h);
  fade.addColorStop(0, "rgba(8, 10, 13, 0)");
  fade.addColorStop(0.45, "rgba(8, 10, 13, 0.55)");
  fade.addColorStop(1, "rgba(8, 10, 13, 0.82)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, h - band * 1.8, w, band * 1.8);

  const pad = 28 * u;
  const baseline = h - pad;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ACCENT;
  ctx.font = `800 ${14 * u}px ${SANS}`;
  ctx.fillText("GOINDOOR", pad, baseline - 30 * u);
  ctx.fillStyle = "#fff";
  ctx.font = `600 ${24 * u}px ${SANS}`;
  ctx.fillText(fit(ctx, routeName, w * 0.3), pad, baseline);

  // Stats from the right edge leftwards.
  let x = w - pad;
  for (const [label, value] of [...stats].reverse()) {
    ctx.font = `700 ${36 * u}px ${NUM}`;
    const valueWidth = ctx.measureText(value).width;
    ctx.font = `700 ${12 * u}px ${SANS}`;
    const width = Math.max(valueWidth, ctx.measureText(label.toUpperCase()).width);
    if (x - width < w * 0.36) break; // keep clear of the route name on narrow screens
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(label.toUpperCase(), x, baseline - 38 * u);
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${36 * u}px ${NUM}`;
    ctx.fillText(value, x, baseline);
    ctx.textAlign = "left";
    x -= width + 30 * u;
  }

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.font = `500 ${13 * u}px ${SANS}`;
  ctx.fillText(when.toLocaleString(getLocale(), { dateStyle: "medium", timeStyle: "short" }), w - pad, pad + 13 * u);
  ctx.textAlign = "left";
  return canvas;
}

/**
 * Where the ride went, as world points [x, z] (north up, as on the maps):
 * every sample that was on a known route, thinned to about `maxPoints`, and
 * always ending where the ride ended.
 * @param {{route: ?string, routeM: ?number}[]} samples
 * @param {Map<string, {positionAt: (d: number) => {x: number, y: number}}>} routesById
 */
export function rideTrack(samples, routesById, maxPoints = 600) {
  const onRoute = samples.filter((s) => s.route && Number.isFinite(s.routeM) && routesById.has(s.route));
  const step = Math.max(1, Math.ceil(onRoute.length / maxPoints));
  const kept = onRoute.filter((_, i) => i % step === 0);
  if (onRoute.length && kept.at(-1) !== onRoute.at(-1)) kept.push(onRoute.at(-1));
  return kept.map((s) => {
    const { x, y } = routesById.get(s.route).positionAt(s.routeM);
    return [x, -y];
  });
}

/** The summary card's parts (1600 × 1200): every text stays inside one of them. */
export const SUMMARY_LAYOUT = Object.freeze({
  header: Object.freeze({ x: 64, y: 48, w: 1472, h: 200 }),
  stats: Object.freeze({ x: 64, y: 272, w: 900, h: 520 }),
  map: Object.freeze({ x: 988, y: 272, w: 548, h: 520 }),
  chart: Object.freeze({ x: 64, y: 816, w: 1472, h: 336 }),
});

/** A rounded rectangle path (no reliance on ctx.roundRect). */
function roundedRect(ctx, { x, y, w, h }, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** A GD glass card: dark tint, white at 9 %, a 22 % outline and a brighter top edge. */
function glassCard(ctx, box, r = 28) {
  roundedRect(ctx, box, r);
  ctx.fillStyle = "rgba(11, 11, 12, 0.55)";
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.09)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(box.x + r, box.y + 1);
  ctx.lineTo(box.x + box.w - r, box.y + 1);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.stroke();
}

/** A small uppercase label, spaced out, as on the GD pages. */
function label(ctx, text, x, y, maxWidth, { color = SILVER, size = 20, align = "left" } = {}) {
  ctx.font = `700 ${size}px ${SANS}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(fit(ctx, text.toUpperCase(), maxWidth), x, y);
  ctx.textAlign = "left";
}

/** The largest bold size (from `size` down) at which `text` fits `maxWidth`. */
function fitFont(ctx, text, maxWidth, size, min = 24) {
  do ctx.font = `700 ${size}px ${NUM}`;
  while (ctx.measureText(text).width > maxWidth && (size -= 2) > min);
  return size;
}

/** The island, its roads and the ridden track, drawn into `box`. */
function drawTrackMap(ctx, box, { routes = [], network = null, track = [] }) {
  const island = network?.island?.() ?? (routes.length ? islandOf(routes) : null);
  const coast = island ? coastOutline(island) : [];
  const roads = [...(network?.roads?.() ?? []), ...routes].map((route) => roadSamples([route], 25).map((s) => [s.x, s.z]));
  const points = coast.length ? coast : track.length ? track : roads.flat();
  if (!points.length) return;
  const frame = mapFrame(points, box.w, box.h, 6);
  const at = ([x, z]) => {
    const [sx, sy] = frame.toScreen(x, z);
    return [box.x + sx, box.y + sy];
  };
  const line = (pts, close = false) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(...at(p)) : ctx.lineTo(...at(p))));
    if (close) ctx.closePath();
  };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (coast.length) {
    line(coast, true);
    ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 2;
  for (const road of roads) if (road.length > 1) (line(road), ctx.stroke());
  if (track.length > 1) {
    line(track);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  if (track.length) {
    const [sx, sy] = at(track[0]);
    const [ex, ey] = at(track.at(-1));
    ctx.beginPath();
    ctx.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex, ey, 10, 0, Math.PI * 2);
    ctx.fillStyle = ACCENT;
    ctx.fill();
  }
}

/**
 * Draws the end-of-ride card (1600 × 1200) in the GD design: the GD monogram
 * and the GOindoor wordmark, the route and date, then glass cards with the
 * totals, a map of where the ride went and the power and elevation of the
 * whole ride, over the last view of the world. It is 4:3 because that's the
 * shape Strava shows activity photos in; a wider card loses its sides there.
 * Every text is fitted to its card (see SUMMARY_LAYOUT).
 * @param {{routeName: string, serverName: string, when: Date, stats: [string, string][],
 *          power: number[], elevation: (number|null)[], scene?: HTMLCanvasElement | null,
 *          map?: {routes?: object[], network?: object | null, track?: number[][]} | null}} info
 */
export function composeSummary({ routeName, serverName, when, stats, power, elevation, scene = null, map = null }, doc = document) {
  const W = 1600;
  const H = 1200;
  const canvas = doc.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const { header, stats: statsBox, map: mapBox, chart } = SUMMARY_LAYOUT;

  // Ground: the last view of the world, darkened, with the GD grey glows.
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  if (scene && scene.width > 0 && scene.height > 0) {
    const scale = Math.max(W / scene.width, H / scene.height);
    const sw = W / scale;
    const sh = H / scale;
    ctx.drawImage(scene, (scene.width - sw) / 2, (scene.height - sh) / 2, sw, sh, 0, 0, W, H);
  }
  const shade = ctx.createLinearGradient(0, 0, W, H);
  shade.addColorStop(0, "rgba(11, 11, 12, 0.94)");
  shade.addColorStop(0.55, "rgba(11, 11, 12, 0.8)");
  shade.addColorStop(1, "rgba(11, 11, 12, 0.62)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient?.(W * 0.12, H * 0.06, 0, W * 0.12, H * 0.06, W * 0.6);
  if (glow) {
    glow.addColorStop(0, "rgba(138, 138, 142, 0.22)");
    glow.addColorStop(1, "rgba(138, 138, 142, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  // Header: GD monogram, the GOindoor wordmark, the date and the route.
  const markH = 52;
  const markY = header.y + 24;
  let x = header.x + 24;
  x += fillMark(ctx, GD_PATH, GD_BOX, { x, y: markY, height: markH });
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.fillRect(x + 22, markY + 4, 2, markH - 8);
  x += 46;
  const goH = 36;
  x += fillMark(ctx, GO_PATH, GO_BOX, { x, y: markY + markH - goH, height: goH });
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = SILVER;
  ctx.font = `700 ${Math.round(goH / 0.72)}px ${SANS}`;
  ctx.fillText("indoor", x + 3, markY + markH);
  const right = header.x + header.w - 24;
  const dateText = when.toLocaleString(getLocale(), { dateStyle: "long", timeStyle: "short" });
  ctx.font = `500 26px ${SANS}`;
  ctx.fillStyle = SILVER;
  ctx.textAlign = "right";
  ctx.fillText(fit(ctx, dateText, header.w * 0.4), right, markY + 30);
  ctx.textAlign = "left";
  label(ctx, serverName, right, markY + markH + 10, header.w * 0.4, { color: GREY, size: 18, align: "right" });
  ctx.fillStyle = ACCENT;
  ctx.font = `700 64px ${SANS}`;
  ctx.fillText(fit(ctx, routeName, header.w - 48), header.x + 24, header.y + header.h - 22);

  // Totals: up to nine, three to a row.
  glassCard(ctx, statsBox);
  const pad = 36;
  const columns = 3;
  const cellW = (statsBox.w - 2 * pad) / columns;
  stats.slice(0, 9).forEach(([name, value], i) => {
    const cx = statsBox.x + pad + (i % columns) * cellW;
    const cy = statsBox.y + pad + Math.floor(i / columns) * 152;
    label(ctx, name, cx, cy + 22, cellW - 20);
    fitFont(ctx, value, cellW - 20, 68);
    ctx.fillStyle = ACCENT;
    ctx.fillText(value, cx, cy + 100);
    if (i % columns === 0 && i > 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(statsBox.x + pad, cy - 16, statsBox.w - 2 * pad, 2);
    }
  });

  // Where the ride went.
  glassCard(ctx, mapBox);
  label(ctx, t("photos.cardRoute"), mapBox.x + 28, mapBox.y + 46, mapBox.w - 56);
  if (map) drawTrackMap(ctx, { x: mapBox.x + 24, y: mapBox.y + 66, w: mapBox.w - 48, h: mapBox.h - 90 }, map);

  // Power (line) and elevation (filled) over the whole ride.
  glassCard(ctx, chart);
  label(ctx, t("photos.cardPower"), chart.x + 32, chart.y + 46, 300, { color: ACCENT });
  ctx.font = `700 20px ${SANS}`;
  const powerWidth = ctx.measureText(t("photos.cardPower").toUpperCase()).width;
  label(ctx, t("photos.cardElevation"), chart.x + 32 + powerWidth + 32, chart.y + 46, 300, { color: GREY });
  const plot = { x: chart.x + 32, y: chart.y + 72, w: chart.w - 64, h: chart.h - 104 };
  const heights = elevation.filter((v) => v !== null && Number.isFinite(v));
  if (heights.length > 1) {
    const series = downsample(elevation.map((v) => (v === null || !Number.isFinite(v) ? heights[0] : v)), 300);
    const lo = Math.min(...series);
    const hi = Math.max(...series, lo + 20);
    ctx.beginPath();
    ctx.moveTo(plot.x, plot.y + plot.h);
    series.forEach((v, i) => ctx.lineTo(plot.x + (i / (series.length - 1)) * plot.w, plot.y + plot.h - ((v - lo) / (hi - lo)) * plot.h * 0.75));
    ctx.lineTo(plot.x + plot.w, plot.y + plot.h);
    ctx.closePath();
    ctx.fillStyle = "rgba(138, 138, 142, 0.35)";
    ctx.fill();
  }
  if (power.length > 1) {
    const series = downsample(power, 300);
    const top = Math.max(...series, 100) * 1.1;
    ctx.beginPath();
    series.forEach((v, i) => {
      const px = plot.x + (i / (series.length - 1)) * plot.w;
      const py = plot.y + plot.h - (v / top) * plot.h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.fillRect(plot.x, plot.y + plot.h, plot.w, 2);
  return canvas;
}

/** Shortens text with an ellipsis until it fits `maxWidth`. */
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/** Resolves with a PNG blob of the canvas. */
export function canvasToPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("could not encode the image"))), "image/png");
  });
}

/** Saves a blob as a file through a temporary link. */
export function downloadBlob(blob, name, doc = document) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(doc.createElement("a"), { href: url, download: name });
  doc.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** True when the device can hand image files to other apps (e.g. the Strava app on a phone). */
export function canShareFiles(nav = globalThis.navigator) {
  try {
    const probe = new File([new Uint8Array(1)], "probe.png", { type: "image/png" });
    return Boolean(nav?.canShare?.({ files: [probe] }));
  } catch {
    return false;
  }
}
