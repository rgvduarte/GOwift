// The numbers the page states, worded from the route stats (lib/route.ts).
// Nothing here is typed in by hand, so the page can't promise more than the
// game has (ADR 0028).

import type { RouteStats } from "./route";

export interface Fact {
  value: string;
  label: string;
}

const whole = (n: number) => Math.round(n).toLocaleString("en");

export function routeFacts(stats: RouteStats): Fact[] {
  return [
    { value: whole(stats.routes), label: "routes to ride" },
    { value: `${whole(stats.lengthM / 1000)} km`, label: "one lap of each" },
    { value: `${whole(stats.climbM)} m`, label: "of climbing on those laps" },
    { value: `${whole(stats.longest.lengthM / 1000)} km`, label: `the longest ride: ${stats.longest.name}` },
  ];
}
