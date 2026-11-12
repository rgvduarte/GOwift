import { test } from "node:test";
import assert from "node:assert/strict";
import { MOTION, climbsStanding, packCadence, riderMotion, saddleState } from "../public/js/view3d/riderMotion.js";
import { rotationZAbout, transformPoint } from "../public/js/view3d/math.js";
import { BODY_JOINTS, RIDER_GEOMETRY, STANDING_HIP, buildForearm, legPose, ridingBodyParts, riderStance, variantLook } from "../public/js/view3d/riderModel.js";

const TURN = Array.from({ length: 72 }, (_, i) => (i / 72) * Math.PI * 2);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// --- math -------------------------------------------------------------------

test("rolling about a pivot keeps the pivot fixed", () => {
  const p = transformPoint(rotationZAbout([0.1, 0.5, 0], 0.3), [0.1, 0.5, 0]);
  assert.ok(dist(p, [0.1, 0.5, 0]) < 1e-6);
});

test("a positive roll tips the top of the bike to its right (+X)", () => {
  assert.ok(transformPoint(rotationZAbout([0, 0, 0], 0.2), [0, 1, 0])[0] > 0.1);
});

// --- the legs reach the pedals ---------------------------------------------------

for (const [name, hip] of [
  ["seated", RIDER_GEOMETRY.hip],
  ["standing", STANDING_HIP],
]) {
  test(`${name}, the feet stay on the pedals all the way round`, () => {
    const { thigh, shin } = RIDER_GEOMETRY;
    for (const phase of TURN) {
      const pose = legPose(phase, hip);
      // A leg that cannot reach is clamped: the shin then no longer ends at the ankle on the pedal.
      assert.ok(Math.abs(dist(pose.knee, hip) - thigh) < 1e-3, `thigh at ${phase.toFixed(2)}`);
      assert.ok(Math.abs(dist(pose.ankle, pose.knee) - shin) < 1e-3, `shin at ${phase.toFixed(2)}`);
    }
  });
}

test("standing, the hips move forward over the cranks", () => {
  assert.ok(STANDING_HIP[2] < RIDER_GEOMETRY.hip[2] - 0.1);
});

// --- the hands stay on the bars ---------------------------------------------------

/** Where each forearm's hand ends up in the bike frame for a stance. */
function hands(stance) {
  const look = variantLook(0);
  const parts = ridingBodyParts(look, stance);
  return ["L", "R"].map((s, i) => {
    const elbow = BODY_JOINTS[`elbow${s}`];
    const hand = BODY_JOINTS[`hand${s}`];
    const tip = [hand[0] - elbow[0], hand[1] - elbow[1], hand[2] - elbow[2]];
    assert.ok(buildForearm(look, i ? 1 : -1).vertexCount > 0);
    return transformPoint(parts.find((p) => p.mesh === `forearm${s}`).model, tip);
  });
}

test("in or out of the saddle the hands stay on the hoods", () => {
  for (const w of [0, 0.3, 0.7, 1]) {
    for (const phase of [0, 1, 2.5, 4]) {
      const stance = riderStance(w, riderMotion(phase, w));
      const [left, right] = hands({ ...stance, roll: 0 });
      assert.ok(dist(left, BODY_JOINTS.handL) < 0.01, `left at w ${w}`);
      assert.ok(dist(right, BODY_JOINTS.handR) < 0.01, `right at w ${w}`);
    }
  }
});

test("standing lifts the shoulders forward over the bars", () => {
  const shoulders = (w) => transformPoint(ridingBodyParts(variantLook(0), riderStance(w, riderMotion(0, w))).find((p) => p.mesh === "torso").model, [0, 0.34, -0.42]);
  assert.ok(shoulders(1)[2] < shoulders(0)[2] - 0.1);
});

// --- rocking ---------------------------------------------------------------------

test("out of the saddle the bike rocks under the rider, evenly to both sides", () => {
  const rolls = TURN.map((phase) => riderMotion(phase, 1).bikeRoll);
  assert.ok(Math.abs(rolls.reduce((a, b) => a + b, 0) / rolls.length) < 1e-9, "zero mean");
  assert.ok(Math.max(...rolls.map(Math.abs)) <= MOTION.rock.standing + 1e-9);
  assert.ok(Math.max(...rolls) > 0.1, "a real rock");
});

test("seated the bike barely moves", () => {
  for (const phase of TURN) assert.ok(Math.abs(riderMotion(phase, 0).bikeRoll) < 0.01);
});

test("the body leans against the bike's rock", () => {
  const { bikeRoll, torsoRoll } = riderMotion(Math.PI / 2, 1);
  assert.ok(Math.sign(torsoRoll) === -Math.sign(bikeRoll));
});

// --- when riders stand ---------------------------------------------------------

/** The standing blend after `seconds` of frames with `input`, from `state`. */
function ride(input, seconds, state = null, dt = 0.05) {
  let s = state;
  for (let t = 0; t < seconds - 1e-9; t += dt) s = saddleState(s, input, dt);
  return s;
}

const cruising = { move: null, grade: 0.02, power: 200, ftp: null, climber: false };

test("a sprint or an attack takes a rider out of the saddle", () => {
  for (const move of ["sprint", "attack", "answer"]) assert.equal(ride({ ...cruising, move }, 1).w, 1, move);
  assert.equal(ride(cruising, 1).w, 0);
});

test("climbers stand on steep ramps, others stay seated", () => {
  assert.equal(ride({ ...cruising, grade: 0.1, climber: true }, 1).w, 1);
  assert.equal(ride({ ...cruising, grade: 0.1, climber: false }, 1).w, 0);
});

test("my own surge over my FTP takes me out of the saddle", () => {
  assert.equal(ride({ ...cruising, power: 400, ftp: 250 }, 1).w, 1);
  assert.equal(ride({ ...cruising, power: 300, ftp: 250 }, 1).w, 0);
});

test("standing up eases in instead of jumping", () => {
  const after = ride({ ...cruising, move: "sprint" }, 0.1);
  assert.ok(after.w > 0 && after.w < 0.5);
});

test("a grade wobbling around the threshold does not flicker the rider up and down", () => {
  let s = ride({ ...cruising, grade: 0.1, climber: true }, 1);
  let downs = 0;
  for (let i = 0; i < 40; i += 1) {
    const before = s.standing;
    s = saddleState(s, { ...cruising, grade: i % 2 ? 0.085 : 0.075, climber: true }, 0.25);
    if (before && !s.standing) downs += 1;
  }
  assert.equal(downs, 0);
});

test("the rider sits down a moment after the effort ends", () => {
  const standing = ride({ ...cruising, move: "sprint" }, 1);
  assert.equal(ride(cruising, MOTION.holdS - 0.2, standing).standing, true, "still up just before");
  assert.equal(ride(cruising, MOTION.holdS + MOTION.easeS + 0.2, standing).w, 0, "seated after");
});

test("riders around me pedal at their own cadences", () => {
  const cadences = new Set(Array.from({ length: 12 }, (_, id) => packCadence(id)));
  assert.ok(cadences.size > 4);
  for (const c of cadences) assert.ok(c >= 82 && c < 91);
  assert.ok(packCadence(-1) >= 82, "a ghost's id too");
});

test("some riders climb out of the saddle by habit, the same ones on every client", () => {
  const habits = Array.from({ length: 200 }, (_, id) => climbsStanding({ id }));
  const share = habits.filter(Boolean).length / habits.length;
  assert.ok(share > 0.25 && share < 0.55);
  assert.equal(climbsStanding({ id: 7 }), climbsStanding({ id: 7 }));
  assert.equal(climbsStanding({ id: 3, style: "climber" }), true, "a climber bot always does");
});
