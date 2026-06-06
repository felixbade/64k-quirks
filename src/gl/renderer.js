import vertSrc from "./fullscreen.vert.glsl";

export function createRenderer(registry) {
  const canvas = document.createElement("canvas");
  canvas.id = "demo";
  canvas.style.imageRendering = "pixelated";
  document.body.appendChild(canvas);

  const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: false });
  if (!gl) throw new Error("WebGL2 not supported");

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const programs = new Map();
  let activeId = null;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh) || "shader compile failed");
    }
    return sh;
  }

  function getProgram(id) {
    if (programs.has(id)) return programs.get(id);

    const mod = registry[id];
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertSrc));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, mod.frag));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "program link failed");
    }

    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.useProgram(program);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const locs = {
      u_resolution: gl.getUniformLocation(program, "u_resolution"),
      u_time: gl.getUniformLocation(program, "u_time"),
      ...mod.cacheLocs(gl, program),
    };

    const res = mod.init ? mod.init(gl, program, locs) : null;
    const entry = { program, locs, mod, res };
    programs.set(id, entry);
    return entry;
  }

  function setActive(id) {
    if (!registry[id]) throw new Error(`unknown shader: ${id}`);
    if (activeId === id) return;
    activeId = id;
    const { mod } = getProgram(id);
    const [w, h] = mod.resolution;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }

  // Compile, link and init every shader up front so the timeline never
  // hitches on a first-time switch. A throwaway draw forces drivers that
  // defer program finalization until first use.
  function warmup() {
    const prev = activeId;
    for (const id of Object.keys(registry)) {
      const { program, locs, mod, res } = getProgram(id);
      gl.useProgram(program);
      mod.apply(gl, locs, mod.defaults, res);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.finish();
    activeId = prev;
  }

  function draw(values, time) {
    if (!activeId) throw new Error("no active shader");
    const { program, locs, mod, res } = getProgram(activeId);
    gl.useProgram(program);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (locs.u_resolution) gl.uniform2f(locs.u_resolution, canvas.width, canvas.height);
    if (locs.u_time) gl.uniform1f(locs.u_time, time);
    mod.apply(gl, locs, values, res);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return {
    canvas,
    gl,
    warmup,
    setActive,
    draw,
    getActiveId: () => activeId,
  };
}
