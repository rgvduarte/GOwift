/**
 * How a rider's body moves on the bike, beyond the pedalling legs: the bike
 * rocks under a rider out of the saddle in time with the cranks, the body
 * leans against it, and riders get up for sprints, attacks and steep ramps.
 * Pure: the pedal phase, the rider's state and the time step are passed in.
 */

export const MOTION = Object.freeze({
  /** The bike's largest roll (radians) seated and out of the saddle. */
  rock: Object.freeze({ seated: 0.004, standing: 0.14 }),
  /** Share of the bike's roll the body leans the other way, so the head stays over the road. */
  counterRoll: 0.6,
  /** A seated rider's shoulders sway this much (radians) with the strokes. */
  seatedSway: 0.02,
  /** Up and down with each stroke (metres). */
  bob: 0.006,
  /** Climbers by habit stand on ramps steeper than this. */
  climbGrade: 0.08,
  /** Share of riders who stand on steep ramps by habit. */
  climberShare: 0.4,
  /** I stand when I push more than this times my FTP. */
  surge: 1.4,
  /** A rider sits down this long after the reason to stand has gone (seconds), so a wobbling grade cannot flicker them. */
  holdS: 1.5,
  /** Standing up or sitting down takes this long (seconds). */
  easeS: 0.35,
});

/** Bot moves that take a rider out of the saddle (docs/protocol.md). */
const STANDING_MOVES = new Set(["sprint", "attack", "answer"]);

/**
 * The bike's roll, the body's roll against it (both radians, about the
 * bike's length, + to the rider's right) and the bob (metres) at pedal
 * `phase` for standing blend `w` (0 seated, 1 out of the saddle).
 */
export function riderMotion(phase, w) {
  const stroke = Math.sin(phase);
  const bikeRoll = (MOTION.rock.seated + (MOTION.rock.standing - MOTION.rock.seated) * w) * stroke;
  const torsoRoll = -MOTION.counterRoll * bikeRoll + MOTION.seatedSway * (1 - w) * stroke;
  return { bikeRoll, torsoRoll, bob: MOTION.bob * Math.abs(stroke) };
}

const easeTowards = (value, goal, step) => (goal > value ? Math.min(goal, value + step) : Math.max(goal, value - step));

/**
 * A rider's standing state one time step `dt` (seconds) on from `prev`
 * (null at first). They stand for a sprint, an attack or answering one, on a
 * ramp steeper than `MOTION.climbGrade` if `climber`, or (my own rider, with
 * `ftp` known) when pushing over `MOTION.surge` times their FTP; they sit
 * down `MOTION.holdS` after the last reason went. `w` eases over `MOTION.easeS`.
 * @returns {{standing: boolean, hold: number, w: number}}
 */
export function saddleState(prev, { move = null, grade = 0, power = 0, ftp = null, climber = false }, dt) {
  const reason = STANDING_MOVES.has(move) || (climber && grade > MOTION.climbGrade) || (ftp > 0 && power > MOTION.surge * ftp);
  const hold = reason ? MOTION.holdS : Math.max(0, (prev?.hold ?? 0) - dt);
  const standing = hold > 0;
  const w = easeTowards(prev?.w ?? 0, standing ? 1 : 0, dt / MOTION.easeS);
  return { standing, hold, w };
}

function hash(n) {
  let h = Math.imul(n ^ 0x5bd1e995, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Whether a rider gets out of the saddle on steep ramps: climber bots always, others by a habit from their id (the same on every client). */
export function climbsStanding({ id, style = null }) {
  return style === "climber" || hash(id) < MOTION.climberShare;
}

/** The cadence (rpm) another rider pedals at while putting out power: each their own, so a pack never spins in lock-step. */
export function packCadence(id) {
  return 82 + ((((id * 37) % 9) + 9) % 9);
}
