/**
 * A WebGL 2 context that draws nothing and remembers what it was told: the
 * capabilities enabled, the uniforms set and, for every draw call, the program
 * and the state it ran with. Enough to test `Renderer` without a GPU.
 * Constants are their own names (`gl.DEPTH_TEST === "DEPTH_TEST"`).
 */
export function fakeGl({ width = 320, height = 200 } = {}) {
  const enabled = new Set();
  const uniforms = new Map();
  const draws = [];
  let program = null;
  let depthMask = true;
  const own = {
    canvas: { width, height },
    draws,
    enabled,
    /** The last value set for `name` in `of` (a program). */
    uniform: (of, name) => uniforms.get(of)?.get(name),
    createShader: (type) => ({ type, source: "" }),
    shaderSource: (shader, source) => (shader.source = source),
    createProgram: () => ({ shaders: [] }),
    attachShader: (p, shader) => p.shaders.push(shader),
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getUniformLocation: (p, name) => ({ program: p, name }),
    getAttribLocation: (_p, name) => ["a_position", "a_normal", "a_color"].indexOf(name),
    useProgram: (p) => (program = p),
    enable: (cap) => enabled.add(cap),
    disable: (cap) => enabled.delete(cap),
    depthMask: (flag) => (depthMask = flag),
    drawArrays: (mode, first, count) => draws.push({ program, mode, count, enabled: new Set(enabled), depthMask, uniforms: new Map(uniforms.get(program)) }),
  };
  const setUniform = (location, value) => {
    if (!location) return;
    if (!uniforms.has(location.program)) uniforms.set(location.program, new Map());
    uniforms.get(location.program).set(location.name, value);
  };
  return new Proxy(own, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop !== "string") return undefined;
      if (/^[A-Z0-9_]+$/.test(prop)) return prop;
      if (/^uniform(Matrix)?[1-4]/.test(prop)) return (location, ...args) => setUniform(location, args.at(-1));
      return () => ({});
    },
  });
}
