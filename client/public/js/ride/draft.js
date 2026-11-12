/**
 * Drafting as seen by the client, mirroring the server's rule for one wheel:
 * up to 6.5 m behind a rider in the same lane reduces drag by up to 30 %, all
 * of it from 2 m (a bike length, middle to middle: the closest riders get) in.
 * Only for an older server that doesn't send its own draft ({@link rideDraft}),
 * and for the gap to the wheel ahead on the map; the server stays authoritative.
 */
export const DRAFT = Object.freeze({ minGap: 2, maxGap: 6.5, maxReduction: 0.3, laneTolerance: 0.5 });

/**
 * @returns {{gap: number, savingPercent: number, leader: object} | null}
 */
export function draftInfo(me, riders, route) {
  let best = null;
  for (const other of riders) {
    if (other.id === me.id || Math.abs(other.lane - me.lane) >= DRAFT.laneTolerance) continue;
    const gap = route.signedGap(me.distance, other.distance);
    if (gap <= 0 || (best && gap >= best.gap)) continue;
    best = { gap, leader: other };
  }
  if (!best || best.gap > DRAFT.maxGap) return null;
  const t = (Math.max(best.gap, DRAFT.minGap) - DRAFT.minGap) / (DRAFT.maxGap - DRAFT.minGap);
  return { ...best, savingPercent: Math.round(DRAFT.maxReduction * (1 - t) * 100) };
}

/**
 * The draft to ride with and to show. A server that sends its own numbers
 * (`state.drag_factor`, `state.draft`) is followed: the client cannot see
 * everything its physics drafts behind (other routes on a shared road, a beer
 * bike's wider shelter, the riders around in a bunch) and must not draft behind
 * what it doesn't (parked riders, other apps' riders). An older server leaves
 * them out, and the local mirror ({@link draftInfo}) stands in.
 * @param {{ state: {drag_factor?: number, draft?: number} | null, me: object | null, riders: object[], route: object }} input
 * @returns {{ dragFactor: number, shown: {gap?: number, leader?: object, savingPercent: number} | null }}
 *   `dragFactor` scales the air drag the pedals feel; `shown` is the drafting
 *   to display, with the gap to the wheel ahead where the mirror sees one.
 */
export function rideDraft({ state, me, riders, route }) {
  const mirror = me ? draftInfo(me, riders, route) : null;
  if (!Number.isFinite(state?.drag_factor)) {
    return { dragFactor: 1 - (mirror?.savingPercent ?? 0) / 100, shown: mirror };
  }
  const savingPercent = Math.round((1 - (state.draft ?? 1)) * 100);
  const wheel = mirror ? { gap: mirror.gap, leader: mirror.leader } : {};
  return { dragFactor: state.drag_factor, shown: savingPercent > 0 ? { ...wheel, savingPercent } : null };
}
