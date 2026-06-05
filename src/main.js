import vertSrc from "./shaders/plasma.vert.glsl";
import fragSrc from "./shaders/plasma.frag.glsl";
import { createPerfOverlay } from "./perf.js";

const WIDTH = 1920 / 3;
const HEIGHT = 1080 / 3;

const canvas = document.createElement("canvas");
canvas.width = WIDTH;
canvas.height = HEIGHT;
canvas.id = "demo";
canvas.style.imageRendering = "pixelated";
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
let costScale = 360; // 5 rays * (48 primary + 24 bounce); tune with [ and ]

const perf = createPerfOverlay(gl);

let audioCtx = null;

function makeDistortionCurve(amount) {
  const n = 44100;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

function kick() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(100, t);
  osc.frequency.exponentialRampToValueAtTime(20, t + 0.08);
  gain.gain.setValueAtTime(1, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  const shaper = audioCtx.createWaveShaper();
  shaper.curve = makeDistortionCurve(10);
  shaper.oversample = "4x";
  const out = audioCtx.createGain();
  out.gain.setValueAtTime(0.6, t);
  osc.connect(gain).connect(shaper).connect(out).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.8);
}

function randomPhaseSaw(ctx, freq, phase) {
  const N = Math.min(2048, Math.floor(ctx.sampleRate / 2 / freq));
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    const amp = 1 / n; // sawtooth harmonic rolloff
    real[n] = amp * Math.sin(n * phase);
    imag[n] = -amp * Math.cos(n * phase);
  }
  return ctx.createPeriodicWave(real, imag);
}

function hihat() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  const t = audioCtx.currentTime;
  const dur = 0.05;
  const n = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const hp = audioCtx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(7000, t);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(hp).connect(gain).connect(audioCtx.destination);
  src.start(t);
  src.stop(t + dur);
}

let bass = null;
function bassKey() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  if (bass) {
    const FMIN = 50;
    const FMAX = 100;
    const factors = [5 / 4];
    const f = factors[(Math.random() * factors.length) | 0];
    bass.freq *= f;
    while (bass.freq > FMAX) bass.freq /= 2;
    while (bass.freq < FMIN) bass.freq *= 2;
    const t = audioCtx.currentTime;
    bass.oscs.forEach((o) => o.frequency.setValueAtTime(bass.freq, t));
    return;
  }
  const t = audioCtx.currentTime;
  const baseFreq = 100;
  const VOICES = 30;
  const DETUNE = 15; // cents spread across unison
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.8, t + 0.05);
  gain.connect(audioCtx.destination);
  const oscs = [];
  for (let i = 0; i < VOICES; i++) {
    const o = audioCtx.createOscillator();
    const vg = audioCtx.createGain();
    o.setPeriodicWave(randomPhaseSaw(audioCtx, baseFreq, Math.random() * 2 * Math.PI));
    o.frequency.setValueAtTime(baseFreq, t);
    o.detune.setValueAtTime((Math.random() * 2 - 1) * DETUNE, t);
    vg.gain.setValueAtTime(1 / VOICES, t);
    o.connect(vg).connect(gain);
    o.start(t);
    oscs.push(o);
  }
  bass = { oscs, gain, freq: baseFreq };
}

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
  if (e.key === "k" || e.key === "K") kick();
  if (e.key === "b" || e.key === "B") bassKey();
  if (e.key === "h" || e.key === "H") hihat();
  if (e.key === "[") costScale = Math.max(1, costScale / 1.25);
  if (e.key === "]") costScale *= 1.25;
});
