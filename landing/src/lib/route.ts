// Reads the bundled routes from ../routes at build time: the elevation profile
// the hero stands on and the facts the page states, so both always match the
// game. Lengths and climbing follow the server (route_file.rs, sim route.rs):
// every route is a loop, so a lap ends with the segment back to the start.

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

interface Marker {
  type: string;
  distance: number;
  length?: number;
}

interface RouteFile {
  name: string;
  points: [number, number, number][];
  markers: Marker[];
}

export interface Profile {
  name: string;
  lengthM: number;
  climbM: number;
  minEle: number;
  maxEle: number;
  /** [distance in m, elevation in m] */
  samples: [number, number][];
  segments: { type: "climb" | "sprint"; from: number; to: number }[];
}

export interface RouteStats {
  /** How many routes the server offers: every top-level *.json file. */
  routes: number;
  /** One lap of every route, in metres. */
  lengthM: number;
  /** The climbing on those laps, in metres. */
  climbM: number;
  longest: { name: string; lengthM: number };
}

// Builds run in landing/, so the bundled routes are one level up. Tests pass
// their own directory.
export const routesDir = resolve(process.cwd(), "../routes");

function readRoute(file: string): RouteFile {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** One lap: distance and elevation at each point, back to the start. */
function lap(route: RouteFile) {
  const points = [...route.points, route.points[0]];
  const samples: [number, number][] = [];
  let distance = 0;
  let climb = 0;
  points.forEach(([x, y, ele], i) => {
    if (i > 0) {
      const [px, py, pe] = points[i - 1];
      distance += Math.hypot(x - px, y - py);
      climb += Math.max(0, ele - pe);
    }
    samples.push([distance, ele]);
  });
  return { samples, lengthM: distance, climbM: climb };
}

export function loadProfile(id: string, dir = routesDir): Profile {
  const route = readRoute(resolve(dir, `${id}.json`));
  const { samples, lengthM, climbM } = lap(route);
  const elevations = samples.map(([, e]) => e);
  return {
    name: route.name,
    lengthM,
    climbM,
    minEle: Math.min(...elevations),
    maxEle: Math.max(...elevations),
    samples,
    segments: route.markers
      .filter((m): m is Marker & { type: "climb" | "sprint" } => m.type === "climb" || m.type === "sprint")
      .map((m) => ({ type: m.type, from: m.distance, to: m.distance + (m.length ?? 0) })),
  };
}

/**
 * Fewer points for drawing a profile: the road is cut into `buckets` equal
 * stretches and each keeps only its lowest and highest point, so peaks and
 * dips survive while the page carries a fraction of the path data.
 */
export function simplifyProfile(samples: [number, number][], buckets: number): [number, number][] {
  if (samples.length <= buckets) return samples;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const span = last[0] - first[0] || 1;
  const kept = new Set<[number, number]>([first, last]);
  const extremes = new Map<number, { low: [number, number]; high: [number, number] }>();
  for (const sample of samples) {
    const bucket = Math.min(buckets - 1, Math.floor(((sample[0] - first[0]) / span) * buckets));
    const seen = extremes.get(bucket);
    if (!seen) extremes.set(bucket, { low: sample, high: sample });
    else if (sample[1] < seen.low[1]) seen.low = sample;
    else if (sample[1] > seen.high[1]) seen.high = sample;
  }
  for (const { low, high } of extremes.values()) kept.add(low).add(high);
  return samples.filter((sample) => kept.has(sample));
}

/** The facts about all routes in `dir`, as the server loads them. */
export function routeStats(dir = routesDir): RouteStats {
  const laps = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const route = readRoute(resolve(dir, name));
      return { name: route.name, ...lap(route) };
    });
  const longest = laps.reduce((a, b) => (b.lengthM > a.lengthM ? b : a));
  return {
    routes: laps.length,
    lengthM: laps.reduce((sum, l) => sum + l.lengthM, 0),
    climbM: laps.reduce((sum, l) => sum + l.climbM, 0),
    longest: { name: longest.name, lengthM: longest.lengthM },
  };
}
