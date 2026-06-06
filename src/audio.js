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

export function kick(when, vel = 1) {
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

export function hihat(when, vel = 1) {
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

export function snare(when, vel = 1) {
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
const PLUCK_NOTES = { 2: 220, 6: 261.63, 14: 329.63, 18: 220, 24: 196, 26: 293.66 };
const PLUCK_VEL = 0.14;
const KICK_VEL = { 0: 1, 10: 0.82, 16: 0.92, 22: 0.78, 8: 0.55 };
const SNARE_VEL = { 4: 1, 12: 0.95, 15: 0.42, 20: 0.88, 28: 0.98, 30: 0.38, 14: 0.5, 26: 0.45, 29: 0.52 };

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

export function startMusic(bpm, startTime = 0) {
  ensureAudio();
  if (amen) return;
  const stepDur = 60 / bpm / 4;
  amen = {
    step: Math.round(startTime / stepDur),
    nextTime: audioCtx.currentTime + 0.05,
    timer: 0,
  };
  const schedule = () => {
    while (amen && amen.nextTime < audioCtx.currentTime + 0.1) {
      const s = amen.step % AMEN_STEPS;
      const pat = Math.floor(amen.step / AMEN_STEPS) % 4 === 3 ? AMEN_FILL : AMEN;
      const loopPhase = s / AMEN_STEPS;
      const cutoff = 11000 + Math.sin(loopPhase * Math.PI * 2) * 1200;
      drumBus.lp.frequency.setValueAtTime(cutoff, amen.nextTime);

      const when = humanizeTime(amen.nextTime, s, stepDur);
      if (pat.kick.has(s)) kick(when, drumVel("kick", s));
      if (pat.snare.has(s)) {
        if (!GHOST_SNARE.has(s) || Math.random() < 0.72) snare(when, drumVel("snare", s));
      }
      if (pat.hat.has(s)) hihat(when, drumVel("hat", s));
      else if (Math.random() < 0.06) hihat(when, 0.35);
      if (PLUCK_NOTES[s]) pluck(when, PLUCK_NOTES[s], PLUCK_VEL * (0.9 + Math.random() * 0.2));

      amen.nextTime += stepDur * (1 + (Math.random() - 0.5) * 0.006);
      amen.step++;
    }
  };
  schedule();
  amen.timer = setInterval(schedule, 25);
}

export function stopMusic() {
  if (!amen) return;
  clearInterval(amen.timer);
  amen = null;
}

export function seekMusic(bpm, time) {
  if (!amen) return;
  stopMusic();
  startMusic(bpm, time);
}
