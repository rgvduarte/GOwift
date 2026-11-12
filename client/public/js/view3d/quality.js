/**
 * Graphics quality tiers (docs/adr/0025-quality-tiers.md): which tier a
 * device starts on, and the frame-time governor that drops an automatic
 * "high" to "low" when the device cannot keep up. Pure: the WebGL renderer
 * name, the device hints and the frame times are passed in.
 */

/** Renderers that draw on the CPU: every pixel of the high tier costs frames there. */
export const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/**
 * The tier a device starts on when the rider has not picked one. Hints the
 * browser does not give (Firefox hides the renderer, Safari the memory)
 * count as fine: the frame governor catches what detection misses.
 * @param {{rendererName?: string, deviceMemory?: number, cores?: number, saveData?: boolean}} hints
 * @returns {"high" | "low"}
 */
export function detectQuality({ rendererName = "", deviceMemory, cores, saveData = false }) {
  if (SOFTWARE_GL.test(rendererName) || saveData) return "low";
  if ((deviceMemory && deviceMemory <= 2) || (cores && cores <= 2)) return "low";
  return "high";
}

/**
 * The GPU's name, from a throwaway context (the real one's attributes, like
 * multisampling, depend on the answer and cannot change once it exists).
 * A fingerprinting surface: read it for the tier, never send or store it.
 */
export function webglRendererName(doc = globalThis.document) {
  try {
    const gl = doc.createElement("canvas").getContext("webgl2");
    if (!gl) return "";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return name;
  } catch {
    return "";
  }
}

/**
 * The rider's own tier from storage, or null for automatic. `choice` is the
 * current key, written only when the rider presses the button; `legacy` the
 * key from before detection, which every ride start set to "high" without
 * asking, so only its "low" was ever a choice.
 */
export function chosenQuality(choice, legacy) {
  if (choice === "high" || choice === "low") return choice;
  return legacy === "low" ? "low" : null;
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Trips once the median frame time over the last `windowS` seconds is above
 * `budgetMs`, and stays tripped: a downgrade that flipped back would make the
 * picture pump. The median ignores the odd hitch (a chunk upload, garbage
 * collection); gaps of `gapMs` or more are pauses (a hidden tab), not frames.
 */
export class FrameBudget {
  #samples = [];
  #total = 0;
  #tripped = false;

  constructor({ budgetMs = 40, windowS = 5, gapMs = 1000 } = {}) {
    this.budgetMs = budgetMs;
    this.windowMs = windowS * 1000;
    this.gapMs = gapMs;
  }

  /** Adds one frame's duration (ms); true once the budget is blown. */
  sample(dtMs) {
    if (this.#tripped) return true;
    if (!(dtMs > 0) || dtMs >= this.gapMs) return false;
    this.#samples.push(dtMs);
    this.#total += dtMs;
    // Keep just enough frames to cover the window.
    while (this.#total - this.#samples[0] >= this.windowMs) this.#total -= this.#samples.shift();
    if (this.#total >= this.windowMs && median(this.#samples) > this.budgetMs) this.#tripped = true;
    return this.#tripped;
  }

  get overBudget() {
    return this.#tripped;
  }
}

/**
 * The tier to draw at: the rider's choice when there is one, else the
 * detected tier, lowered once if the frames do not keep up. Never raised
 * automatically, and never lowered under a rider who picked "high".
 */
export class QualityGovernor {
  #choice;
  #tier;
  #budget;

  /** @param {{choice: "high" | "low" | null, detected: "high" | "low", budget?: FrameBudget}} options */
  constructor({ choice, detected, budget = new FrameBudget() }) {
    this.#choice = choice === "high" || choice === "low" ? choice : null;
    this.#tier = detected === "low" ? "low" : "high";
    this.#budget = budget;
    /** Multisampling is fixed when the WebGL context is made, so it follows the starting tier. */
    this.antialias = this.quality === "high";
  }

  get quality() {
    return this.#choice ?? this.#tier;
  }

  /** True while the tier is automatic (not the rider's pick). */
  get auto() {
    return this.#choice === null;
  }

  /** The rider picked a tier: it holds from now on. */
  choose(quality) {
    if (quality === "high" || quality === "low") this.#choice = quality;
  }

  /** Feeds one drawn frame's duration (ms); true on the one frame the automatic tier drops to low. */
  frame(dtMs) {
    if (!this.auto || this.#tier === "low") return false;
    if (!this.#budget.sample(dtMs)) return false;
    this.#tier = "low";
    return true;
  }
}
