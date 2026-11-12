import { test } from "node:test";
import assert from "node:assert/strict";
import { FrameBudget, QualityGovernor, chosenQuality, detectQuality, webglRendererName } from "../public/js/view3d/quality.js";
import { createContext } from "../public/js/view3d/renderer.js";

const GPU = "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)";

test("software renderers start on the low tier", () => {
  for (const rendererName of [
    "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
    "Google SwiftShader",
    "llvmpipe (LLVM 15.0.7, 256 bits)",
    "softpipe",
    "ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)",
  ]) {
    assert.equal(detectQuality({ rendererName, deviceMemory: 8, cores: 8 }), "low", rendererName);
  }
});

test("a real GPU with memory to spare starts on the high tier", () => {
  assert.equal(detectQuality({ rendererName: GPU, deviceMemory: 8, cores: 8 }), "high");
});

test("browsers that hide the device details start on the high tier", () => {
  assert.equal(detectQuality({}), "high");
});

test("data saver, little memory or two cores start on the low tier", () => {
  assert.equal(detectQuality({ rendererName: GPU, saveData: true }), "low");
  assert.equal(detectQuality({ rendererName: GPU, deviceMemory: 2 }), "low");
  assert.equal(detectQuality({ rendererName: GPU, cores: 2 }), "low");
});

test("the renderer's name is read from a throwaway context, which is then let go", () => {
  let lost = false;
  const gl = {
    RENDERER: 0x1f01,
    getExtension: (name) => (name === "WEBGL_debug_renderer_info" ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : name === "WEBGL_lose_context" ? { loseContext: () => (lost = true) } : null),
    getParameter: (p) => (p === 0x9246 ? GPU : "WebKit WebGL"),
  };
  const doc = { createElement: () => ({ getContext: (kind) => (kind === "webgl2" ? gl : null) }) };
  assert.deepEqual([webglRendererName(doc), lost], [GPU, true]);
});

test("without WebGL 2 the renderer has no name", () => {
  assert.equal(webglRendererName({ createElement: () => ({ getContext: () => null }) }), "");
  assert.equal(
    webglRendererName({
      createElement: () => {
        throw new Error("no DOM");
      },
    }),
    "",
  );
});

test("a stored high from before auto-detection is no choice, a stored low is", () => {
  assert.equal(chosenQuality(null, "high"), null);
  assert.equal(chosenQuality(null, "low"), "low");
  assert.equal(chosenQuality(null, null), null);
  assert.equal(chosenQuality("high", "low"), "high", "today's choice wins over the old key");
  assert.equal(chosenQuality("bogus", null), null);
});

const frames = (budget, count, ms) => {
  let over = false;
  for (let i = 0; i < count; i += 1) over = budget.sample(ms);
  return over;
};

test("frames over budget for the whole window trip the budget", () => {
  assert.equal(frames(new FrameBudget({ budgetMs: 40, windowS: 5 }), 300, 50), true);
});

test("a short run of slow frames does not trip the budget", () => {
  assert.equal(frames(new FrameBudget({ budgetMs: 40, windowS: 5 }), 60, 50), false, "3 s of slow frames are not 5 s");
});

test("one slow frame among quick ones does not trip the budget", () => {
  const budget = new FrameBudget({ budgetMs: 40, windowS: 5 });
  frames(budget, 200, 16);
  budget.sample(60);
  assert.equal(frames(budget, 200, 16), false);
});

test("a tripped budget stays tripped when frames get quick again", () => {
  const budget = new FrameBudget({ budgetMs: 40, windowS: 5 });
  frames(budget, 300, 50);
  assert.equal(frames(budget, 1000, 10), true);
  assert.equal(budget.overBudget, true);
});

test("a pause between frames (a hidden tab) is not a slow frame", () => {
  const budget = new FrameBudget({ budgetMs: 40, windowS: 5 });
  assert.equal(frames(budget, 20, 5000), false);
});

test("the rider's choice wins over detection", () => {
  assert.equal(new QualityGovernor({ choice: "high", detected: "low" }).quality, "high");
  assert.equal(new QualityGovernor({ choice: null, detected: "low" }).quality, "low");
  assert.equal(new QualityGovernor({ choice: "low", detected: "high" }).auto, false);
});

const slowFrames = (governor, count = 400) => Array.from({ length: count }, () => governor.frame(60)).filter(Boolean).length;

test("an auto tier that cannot keep up drops to low, once", () => {
  const governor = new QualityGovernor({ choice: null, detected: "high" });
  assert.equal(slowFrames(governor), 1, "one downgrade");
  assert.equal(governor.quality, "low");
  assert.equal(governor.auto, true, "still not the rider's choice");
});

test("the rider's high tier is never lowered behind their back", () => {
  const governor = new QualityGovernor({ choice: "high", detected: "high" });
  assert.equal(slowFrames(governor), 0);
  assert.equal(governor.quality, "high");
});

test("choosing a tier ends the automatic one", () => {
  const governor = new QualityGovernor({ choice: null, detected: "low" });
  governor.choose("high");
  assert.deepEqual([governor.quality, governor.auto, slowFrames(governor)], ["high", false, 0]);
});

test("quick frames never raise an auto low tier", () => {
  const governor = new QualityGovernor({ choice: null, detected: "low" });
  for (let i = 0; i < 1000; i += 1) governor.frame(8);
  assert.equal(governor.quality, "low");
});

test("the WebGL context multisamples only when asked to", () => {
  const canvas = { getContext: (kind, attributes) => ({ kind, attributes }) };
  assert.equal(createContext(canvas).attributes.antialias, true, "on by default");
  const context = createContext(canvas, { antialias: false });
  assert.deepEqual([context.kind, context.attributes.antialias], ["webgl2", false]);
});

test("the low tier draws without multisampling, the high one with it", () => {
  assert.equal(new QualityGovernor({ choice: null, detected: "low" }).antialias, false);
  assert.equal(new QualityGovernor({ choice: "high", detected: "low" }).antialias, true);
});
