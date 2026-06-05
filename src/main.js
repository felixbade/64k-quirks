import vertSrc from "./shaders/plasma.vert.glsl";
import fragSrc from "./shaders/plasma.frag.glsl";
import { createPerfOverlay } from "./perf.js";

const WIDTH = 1920;
const HEIGHT = 1080;

const canvas = document.createElement("canvas");
canvas.width = WIDTH;
canvas.height = HEIGHT;
canvas.id = "demo";
document.body.appendChild(canvas);

const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: false });
if (!gl) throw new Error("WebGL2 not supported");

function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || "shader compile failed");
  }
  return sh;
}

const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertSrc));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
  throw new Error(gl.getProgramInfoLog(prog) || "program link failed");
}
gl.useProgram(prog);

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(prog, "a_pos");
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const uRes = gl.getUniformLocation(prog, "u_resolution");
const uTime = gl.getUniformLocation(prog, "u_time");
const uDebug = gl.getUniformLocation(prog, "u_debug");
const uCostScale = gl.getUniformLocation(prog, "u_costScale");

let debug = 0;
let costScale = 960; // 5 rays * (96 primary + 96 bounce); tune with [ and ]

const perf = createPerfOverlay(gl);

const start = performance.now();
function frame(now) {
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(uRes, canvas.width, canvas.height);
  gl.uniform1f(uTime, (now - start) / 1000);
  gl.uniform1i(uDebug, debug);
  gl.uniform1f(uCostScale, costScale);
  perf.beginGpu();
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  perf.endGpu();
  perf.update(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener("keydown", (e) => {
  if (e.key === "f" || e.key === "F") {
    if (document.fullscreenElement) document.exitFullscreen();
    else canvas.requestFullscreen();
  }
  if (e.key === "p" || e.key === "P") perf.toggle();
  if (e.key === "r" || e.key === "R") perf.reset();
  if (e.key === "c" || e.key === "C") debug = debug ? 0 : 1;
  if (e.key === "[") costScale = Math.max(1, costScale / 1.25);
  if (e.key === "]") costScale *= 1.25;
});
