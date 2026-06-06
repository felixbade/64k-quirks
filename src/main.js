import { createRenderer } from "./gl/renderer.js";
import { SHADERS, SHADER_IDS } from "./shaders/registry.js";
import { TIMELINE, sampleTimeline } from "./timeline.js";
import { createTransport } from "./transport.js";
import { createEditSession } from "./edit.js";
import { createPerfOverlay } from "./perf.js";
import { seekMusic, startMusic, stopMusic } from "./audio.js";

const DEMO_BARS = 64;
const renderer = createRenderer(SHADERS);
const transport = createTransport(TIMELINE.bpm, (DEMO_BARS * 4 * 60) / TIMELINE.bpm);
let sample = sampleTimeline(TIMELINE, 0);
const edit = createEditSession(SHADERS, () => sample);
const perf = createPerfOverlay(renderer.gl);

let debug = 0;
let shaderOverride = null;

document.body.appendChild(transport.element);
transport.player.addEventListener("play", () => {
  shaderOverride = null;
  startMusic(TIMELINE.bpm, transport.currentTime);
});
transport.player.addEventListener("pause", stopMusic);
transport.player.addEventListener("seek", (e) => seekMusic(TIMELINE.bpm, e.detail.time));
transport.player.addEventListener("end", stopMusic);

function frame(now) {
  const beat = transport.beat();
  if (transport.paused && shaderOverride !== null) {
    sample = { shaderId: shaderOverride, values: { ...SHADERS[shaderOverride].defaults } };
  } else {
    sample = sampleTimeline(TIMELINE, beat);
  }
  renderer.setActive(sample.shaderId);
  edit.setActiveShader(sample.shaderId);
  const overrides = edit.getOverridesForShader(sample.shaderId);

  perf.beginGpu();
  renderer.draw({ ...sample.values, ...overrides }, transport.currentTime, debug);
  perf.endGpu();
  perf.update(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener("keydown", (e) => {
  const { canvas } = renderer;
  if (e.key === "f" || e.key === "F") {
    if (document.fullscreenElement) document.exitFullscreen();
    else canvas.requestFullscreen();
  }
  if (e.key === "p" || e.key === "P") perf.toggle();
  if (e.key === "r" || e.key === "R") perf.reset();
  if (e.key === "c" || e.key === "C") debug = debug ? 0 : 1;
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    if (!transport.paused) return;
    e.preventDefault();
    const n = SHADER_IDS.length;
    const base = SHADER_IDS.indexOf(shaderOverride ?? sample.shaderId);
    const dir = e.key === "ArrowRight" ? 1 : -1;
    shaderOverride = SHADER_IDS[((base + dir) % n + n) % n];
  }
});
