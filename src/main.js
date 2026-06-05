import vertSrc from "./shaders/plasma.vert.glsl";
import fragSrc from "./shaders/plasma.frag.glsl";

const WIDTH = 1920;
const HEIGHT = 1080;

const canvas = document.createElement("canvas");
canvas.width = WIDTH;
canvas.height = HEIGHT;
canvas.id = "demo";
document.body.appendChild(canvas);

const gl = canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: false });
if (!gl) throw new Error("WebGL not supported");

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

const start = performance.now();
function frame(now) {
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(uRes, canvas.width, canvas.height);
  gl.uniform1f(uTime, (now - start) / 1000);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener("keydown", (e) => {
  if (e.key === "f" || e.key === "F") {
    if (document.fullscreenElement) document.exitFullscreen();
    else canvas.requestFullscreen();
  }
});
