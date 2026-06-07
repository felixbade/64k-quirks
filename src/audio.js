let audioCtx = null;
let drumBus = null;
let buses = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (!drumBus) {
    const gain = audioCtx.createGain();
    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 11000;
    lp.Q.value = 0.5;
    gain.connect(lp).connect(audioCtx.destination);
    drumBus = { gain, lp };
  }
  if (!buses) {
    // Per-voice buses carve the crowded 150-350 Hz low-mid so voices stop
    // masking each other. Master lowpass stays as the glue.
    const make = (nodes, level = 1) => {
      const inGain = audioCtx.createGain();
      inGain.gain.value = level;
      let tail = inGain;
      for (const n of nodes) tail = tail.connect(n);
      tail.connect(drumBus.gain);
      return inGain;
    };
    const hp = (freq, Q = 0.7) => {
      const f = audioCtx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = freq;
      f.Q.value = Q;
      return f;
    };
    buses = {
      kick: make([]),                       // owns the sub, untouched
      snare: make([hp(120, 0.6)]),          // clear the kick sub
      hat: make([hp(4000, 0.6)]),           // top end only
      talk: make([hp(280, 0.7)], 0.6),      // lives in the 340-580 pocket above pluck
      pluck: make([hp(260, 0.7)], 1.0),     // no lows, lives up top
    };
  }
}

function drumDest(name = "kick") {
  ensureAudio();
  return buses[name];
}

// Call synchronously inside a user gesture. iOS Safari needs resume() plus a
// real node started in the same turn — silent buffers alone aren't enough.
export function unlockAudio() {
  ensureAudio();
  const ctx = audioCtx;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.00001, t);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.02);
  if (ctx.state !== "running") void ctx.resume();
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
  osc.connect(gain).connect(shaper).connect(out).connect(drumDest("kick"));
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
  src.connect(hp).connect(gain).connect(drumDest("hat"));
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
  src.connect(hp).connect(nGain).connect(drumDest("snare"));

  const osc = audioCtx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(body, t);
  osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
  const oGain = audioCtx.createGain();
  oGain.gain.setValueAtTime(0.5 * vel, t);
  oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(oGain).connect(drumDest("snare"));

  src.start(t);
  src.stop(t + dur);
  osc.start(t);
  osc.stop(t + 0.12);
}

const GLIDE_DEPTH = 1;

// Lifted into the 340-580 Hz pocket (above pluck fundamental, below its
// shimmer). Open tail shortened so it stops bleeding over the pluck.
const TALK_STROKES = {
  open: { base: 300, peak: 470, bend: 0.32, decay: 0.1, tail: 0.16, level: 0.5 },
  slap: { base: 330, peak: 600, bend: 0.18, decay: 0.04, tail: 0.09, level: 0.46, distort: 5 },
  muted: { base: 300, peak: 330, bend: 0.06, decay: 0.022, tail: 0.05, level: 0.36 },
};

function talkDrum(when, stroke, vel = 1) {
  ensureAudio();
  const t = when ?? audioCtx.currentTime;
  const cfg = TALK_STROKES[stroke];
  const jitter = 0.96 + Math.random() * 0.08;
  const base = cfg.base * jitter;
  const peak = cfg.peak * jitter;
  const bend = cfg.bend * GLIDE_DEPTH * (0.88 + Math.random() * 0.24);
  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(base, t);
  osc.frequency.exponentialRampToValueAtTime(peak, t + bend);
  osc.frequency.exponentialRampToValueAtTime(base * 0.82, t + cfg.decay);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(vel, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + cfg.tail);
  let node = gain;
  if (cfg.distort) {
    const shaper = audioCtx.createWaveShaper();
    shaper.curve = makeDistortionCurve(cfg.distort);
    shaper.oversample = "4x";
    osc.connect(gain).connect(shaper);
    node = shaper;
  } else {
    osc.connect(gain);
  }
  const out = audioCtx.createGain();
  out.gain.setValueAtTime(cfg.level * vel, t);
  node.connect(out).connect(drumDest("talk"));
  osc.start(t);
  osc.stop(t + cfg.tail);
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
  osc.connect(bp).connect(gain).connect(drumDest("pluck"));
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
const SABAR_STEPS = 12;
const SABAR_CALL = { 0: ["open", 0.88], 4: ["slap", 0.72], 7: ["muted", 0.48], 10: ["open", 0.62] };
const SABAR_RESP = { 1: ["slap", 0.78], 5: ["open", 0.68], 8: ["slap", 0.55], 11: ["muted", 0.42] };
const SNARE_BACKBEAT = new Set([4, 12, 20, 28]);

// Arrangement. 16 four-four bars, then loops. Controls WHICH voices play so
// the grid is never fully saturated. Derived from bar count only, so it stays
// consistent across seeks. amen bar = floor(step/16); talk bar = floor(tripletStep/12).
const SECTION_BARS = 32;
function sectionFlags(bar) {
  const b = ((bar % SECTION_BARS) + SECTION_BARS) % SECTION_BARS;
  // Talk only ever plays where snare AND pluck drop, so it owns the mid alone
  // (call-and-response break). Kick + hat stay for pulse.
  if (b < 8) return { kick: 1, snare: 1, hat: 1, pluck: 0, talk: 0 }; // A: amen establishes 4/4
  if (b < 16) return { kick: 1, snare: 1, hat: 1, pluck: 1, talk: 0 }; // B: + pluck groove
  if (b < 20) return { kick: 1, snare: 0, hat: 1, pluck: 0, talk: 1 }; // talk break: drum speaks
  if (b < 28) return { kick: 1, snare: 1, hat: 1, pluck: 1, talk: 0 }; // C: full groove
  return { kick: 1, snare: 0, hat: 1, pluck: 0, talk: 1 }; // outro talk break
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

function runAmen(bpm, startTime) {
  const stepDur = 60 / bpm / 4;
  const tripletDur = stepDur * (4 / 3);
  const lead = 0.12;
  const t0 = audioCtx.currentTime;
  amen = {
    step: Math.round(startTime / stepDur),
    nextTime: t0 + lead,
    tripletStep: Math.round(startTime / tripletDur),
    tripletNextTime: t0 + lead,
    tripletDur,
    timer: 0,
  };
  const schedule = () => {
    while (amen && amen.nextTime < audioCtx.currentTime + 0.1) {
      const s = amen.step % AMEN_STEPS;
      const sec = sectionFlags(Math.floor(amen.step / 16));
      const pat = Math.floor(amen.step / AMEN_STEPS) % 4 === 3 ? AMEN_FILL : AMEN;
      const loopPhase = s / AMEN_STEPS;
      const cutoff = 11000 + Math.sin(loopPhase * Math.PI * 2) * 1200;
      drumBus.lp.frequency.setValueAtTime(cutoff, amen.nextTime);

      const when = humanizeTime(amen.nextTime, s, stepDur);
      if (sec.kick && pat.kick.has(s)) kick(when, drumVel("kick", s));
      if (sec.snare && pat.snare.has(s)) {
        if (!GHOST_SNARE.has(s) || Math.random() < 0.72) snare(when, drumVel("snare", s));
      }
      if (sec.hat) {
        if (pat.hat.has(s)) hihat(when, drumVel("hat", s));
        else if (Math.random() < 0.06) hihat(when, 0.35);
      }
      if (sec.pluck && PLUCK_NOTES[s]) pluck(when, PLUCK_NOTES[s], PLUCK_VEL * (0.9 + Math.random() * 0.2));

      amen.nextTime += stepDur * (1 + (Math.random() - 0.5) * 0.006);
      amen.step++;
    }
    while (amen && amen.tripletNextTime < audioCtx.currentTime + 0.1) {
      const ts = amen.tripletStep % SABAR_STEPS;
      const bar = Math.floor(amen.tripletStep / SABAR_STEPS);
      const pat = bar % 2 === 0 ? SABAR_CALL : SABAR_RESP;
      let hit = sectionFlags(bar).talk ? pat[ts] : null;
      // Dodge: weave talk around the snare backbeat and the pluck so it never
      // strikes the same instant. Lets talk fill the gaps (interlocking).
      if (hit) {
        const nearStep = Math.round((amen.tripletStep * 4) / 3);
        const s32 = ((nearStep % AMEN_STEPS) + AMEN_STEPS) % AMEN_STEPS;
        const secNear = sectionFlags(Math.floor(nearStep / 16));
        if ((secNear.pluck && PLUCK_NOTES[s32]) || (secNear.snare && SNARE_BACKBEAT.has(s32))) hit = null;
      }
      if (hit) {
        const when = amen.tripletNextTime + (Math.random() - 0.5) * 0.004;
        talkDrum(when, hit[0], hit[1] * (0.92 + Math.random() * 0.08));
      }
      amen.tripletNextTime += amen.tripletDur * (1 + (Math.random() - 0.5) * 0.005);
      amen.tripletStep++;
    }
  };
  const tick = () => {
    if (!amen) return;
    schedule();
    amen.timer = requestAnimationFrame(tick);
  };
  schedule();
  amen.timer = requestAnimationFrame(tick);
}

export function startMusic(bpm, startTime = 0) {
  ensureAudio();
  if (amen) return;
  const begin = () => {
    if (amen) return;
    runAmen(bpm, startTime);
  };
  if (audioCtx.state === "running") {
    begin();
    return;
  }
  const onState = () => {
    if (audioCtx.state !== "running") return;
    audioCtx.removeEventListener("statechange", onState);
    clearTimeout(fallback);
    begin();
  };
  audioCtx.addEventListener("statechange", onState);
  void audioCtx.resume();
  onState();
  const fallback = setTimeout(() => {
    audioCtx.removeEventListener("statechange", onState);
    void audioCtx.resume();
    begin();
  }, 300);
}

export function stopMusic() {
  if (!amen) return;
  cancelAnimationFrame(amen.timer);
  amen = null;
}

export function seekMusic(bpm, time) {
  if (!amen) return;
  stopMusic();
  startMusic(bpm, time);
}
