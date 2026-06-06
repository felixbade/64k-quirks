import vertSrc from "./shaders/plasma.vert.glsl";
import fragSrc from "./shaders/plasma.frag.glsl";
import { createPerfOverlay } from "./perf.js";

const WIDTH = 1920 / 3;
const HEIGHT = 1080 / 3;

const BPM = 165;

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
const uSkyFlip = gl.getUniformLocation(prog, "u_skyFlip");
const uKifsScale = gl.getUniformLocation(prog, "u_kifsScale");
const uKifsOffset = gl.getUniformLocation(prog, "u_kifsOffset");
const uKifsSize = gl.getUniformLocation(prog, "u_kifsSize");
const uKifsRot = gl.getUniformLocation(prog, "u_kifsRot");

// KIFS parameter groups. Group 0 is the original hand-tuned look; the rest are
// hardcoded so they can be edited by hand.
const KIFS_GROUPS = [
  { scale: 1.9, offset: [1.0, 0.85, 0.6], size: 2.0, rotX: 0.5, rotY: 0.8 },
  { scale: 1.9, offset: [1.1, 0.85, 0.6], size: 3.0, rotX: 0.5, rotY: 0.8 },
];

// Beat-timestamp -> KIFS params to switch to at that beat.
const KIFS_SCHEDULE = {
  0: KIFS_GROUPS[0],
  4: KIFS_GROUPS[1],
  8: KIFS_GROUPS[0],
  12: KIFS_GROUPS[1],
};
const KIFS_KEYS = Object.keys(KIFS_SCHEDULE).map(Number).sort((a, b) => a - b);

function kifsForBeat(beat) {
  let g = KIFS_GROUPS[0];
  if (beat < 0) return g;
  for (const k of KIFS_KEYS) {
    if (k <= beat) g = KIFS_SCHEDULE[k];
    else break;
  }
  return g;
}

function applyKifs(g) {
  gl.uniform1f(uKifsScale, g.scale);
  gl.uniform3f(uKifsOffset, g.offset[0], g.offset[1], g.offset[2]);
  gl.uniform1f(uKifsSize, g.size);
  gl.uniform2f(uKifsRot, g.rotX, g.rotY);
}

let debug = 0;
let costScale = 360; // 5 rays * (48 primary + 24 bounce); tune with [ and ]

const perf = createPerfOverlay(gl);

let audioCtx = null;
let drumBus = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  if (!drumBus) {
    const gain = audioCtx.createGain();
    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 11000;
    lp.Q.value = 0.5;
    gain.connect(lp).connect(audioCtx.destination);
    drumBus = { gain, lp };
  }
}

function drumDest() {
  ensureAudio();
  return drumBus.gain;
}

function makeDistortionCurve(amount) {
  const n = 44100;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

function kick(when, vel = 1) {
  ensureAudio();
  const t = when ?? audioCtx.currentTime;
  const startFreq = 100 + (Math.random() - 0.5) * 6;
  const endFreq = 20 + (Math.random() - 0.5) * 3;
  const decay = 0.08 + (Math.random() - 0.5) * 0.008;
  const tail = 0.8 + (Math.random() - 0.5) * 0.04;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(startFreq, t);
  osc.frequency.exponentialRampToValueAtTime(endFreq, t + decay);
  gain.gain.setValueAtTime(vel, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + tail);
  const shaper = audioCtx.createWaveShaper();
  shaper.curve = makeDistortionCurve(10);
  shaper.oversample = "4x";
  const out = audioCtx.createGain();
  out.gain.setValueAtTime(0.6 * vel, t);
  osc.connect(gain).connect(shaper).connect(out).connect(drumDest());
  osc.start(t);
  osc.stop(t + tail);
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

function hihat(when, vel = 1) {
  ensureAudio();
  const t = when ?? audioCtx.currentTime;
  const dur = 0.05 + (Math.random() - 0.5) * 0.012;
  const n = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const hp = audioCtx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(7000 + (Math.random() - 0.5) * 800, t);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.5 * vel, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(hp).connect(gain).connect(drumDest());
  src.start(t);
  src.stop(t + dur);
}

function snare(when, vel = 1) {
  ensureAudio();
  const t = when ?? audioCtx.currentTime;
  const dur = 0.2;
  const body = 180 + (Math.random() - 0.5) * 12;
  const n = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const hp = audioCtx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(1500 + (Math.random() - 0.5) * 200, t);
  const nGain = audioCtx.createGain();
  nGain.gain.setValueAtTime(0.6 * vel, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(hp).connect(nGain).connect(drumDest());

  const osc = audioCtx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(body, t);
  osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
  const oGain = audioCtx.createGain();
  oGain.gain.setValueAtTime(0.5 * vel, t);
  oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(oGain).connect(drumDest());

  src.start(t);
  src.stop(t + dur);
  osc.start(t);
  osc.stop(t + 0.12);
}

function pluck(when, freq, vel = 1) {
  ensureAudio();
  const t = when ?? audioCtx.currentTime;
  const dur = 0.12;
  const osc = audioCtx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, t);
  const bp = audioCtx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(freq * 3, t);
  bp.Q.value = 4;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vel, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(bp).connect(gain).connect(drumDest());
  osc.start(t);
  osc.stop(t + dur);
}

// Amen break: 2 bars of 16th notes (32 steps).
const AMEN_STEPS = 32;
const AMEN = {
  kick: new Set([0, 10, 16, 22]),
  snare: new Set([4, 12, 15, 20, 28, 30]),
  hat: new Set(Array.from({ length: 16 }, (_, i) => i * 2)),
};
const AMEN_FILL = {
  kick: new Set([0, 8, 10, 16, 22]),
  snare: new Set([4, 12, 14, 15, 20, 26, 28, 29, 30, 31]),
  hat: new Set(Array.from({ length: 16 }, (_, i) => i * 2)),
};
const GHOST_SNARE = new Set([15, 30]);
// Faint background pluck: step -> note (Hz), minor pentatonic around A2.
const PLUCK_NOTES = { 2: 220, 6: 261.63, 14: 329.63, 18: 220, 24: 196, 26: 293.66 };
const PLUCK_VEL = 0.14;
const KICK_VEL = { 0: 1, 10: 0.82, 16: 0.92, 22: 0.78, 8: 0.55 };
const SNARE_VEL = { 4: 1, 12: 0.95, 15: 0.42, 20: 0.88, 28: 0.98, 30: 0.38, 14: 0.5, 26: 0.45, 29: 0.52 };

function makeChopMap() {
  const map = Array.from({ length: AMEN_STEPS }, (_, i) => i);
  for (let bar = 0; bar < 2; bar++) {
    const base = bar * 16;
    if (Math.random() < 0.6) {
      const a = base + 4 + ((Math.random() * 5) | 0) * 2;
      [map[a], map[a + 1]] = [map[a + 1], map[a]];
    }
  }
  return map;
}

function drumVel(kind, step) {
  const table = kind === "kick" ? KICK_VEL : kind === "snare" ? SNARE_VEL : null;
  const base = table?.[step] ?? 0.88;
  return base * (0.94 + Math.random() * 0.06);
}

function humanizeTime(t, step, stepDur) {
  t += (Math.random() - 0.5) * 0.003;
  if (step % 2 === 1) t += stepDur * 0.018;
  return t;
}

let amen = null;
function toggleAmen() {
  ensureAudio();
  if (amen) {
    clearInterval(amen.timer);
    amen = null;
    return;
  }
  const stepDur = 60 / BPM / 4;
  amen = {
    step: 0,
    nextTime: audioCtx.currentTime + 0.05,
    timer: 0,
    beatTimes: [], // audio time of each beat (every 4 steps), follows tempo drift
  };
  const schedule = () => {
    while (amen.nextTime < audioCtx.currentTime + 0.1) {
      const s = amen.step % AMEN_STEPS;
      if (amen.step % 4 === 0) amen.beatTimes.push(amen.nextTime);
      const src = s;
      const pat = Math.floor(amen.step / AMEN_STEPS) % 4 === 3 ? AMEN_FILL : AMEN;
      const loopPhase = s / AMEN_STEPS;
      const cutoff = 11000 + Math.sin(loopPhase * Math.PI * 2) * 1200;
      drumBus.lp.frequency.setValueAtTime(cutoff, amen.nextTime);

      const when = humanizeTime(amen.nextTime, s, stepDur);
      if (pat.kick.has(src)) kick(when, drumVel("kick", src));
      if (pat.snare.has(src)) {
        if (!GHOST_SNARE.has(src) || Math.random() < 0.72) snare(when, drumVel("snare", src));
      }
      if (pat.hat.has(src)) hihat(when, drumVel("hat", src));
      else if (Math.random() < 0.06) hihat(when, 0.35);
      if (PLUCK_NOTES[src]) pluck(when, PLUCK_NOTES[src], PLUCK_VEL * (0.9 + Math.random() * 0.2));

      amen.nextTime += stepDur * (1 + (Math.random() - 0.5) * 0.006);
      amen.step++;
    }
  };
  schedule();
  amen.timer = setInterval(schedule, 25);
}

let bass = null;
function bassKey() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  if (bass) {
    const FMIN = 30;
    const FMAX = 60;
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
  const baseFreq = 50;
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
  let beat = -1;
  if (audioCtx && amen) {
    const bt = amen.beatTimes;
    const t = audioCtx.currentTime;
    while (beat + 1 < bt.length && bt[beat + 1] <= t) beat++;
  }
  gl.uniform1f(uSkyFlip, beat >= 0 && beat & 1 ? -1.0 : 1.0);
  applyKifs(kifsForBeat(beat));
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
  if (e.key === "s" || e.key === "S") snare();
  if (e.key === "a" || e.key === "A") toggleAmen();
  if (e.key === "[") costScale = Math.max(1, costScale / 1.25);
  if (e.key === "]") costScale *= 1.25;
});
