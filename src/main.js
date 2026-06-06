import { createRenderer } from "./gl/renderer.js";
import { SHADERS, SHADER_IDS } from "./shaders/registry.js";
import { TIMELINE, sampleTimeline } from "./timeline.js";
import { createTransport } from "./transport.js";
import { createEditSession } from "./edit.js";
import { createPerfOverlay } from "./perf.js";
import { kick, snare, hihat, bassKey, toggleAmen } from "./audio.js";

const renderer = createRenderer(SHADERS);
const transport = createTransport(TIMELINE.bpm);
const edit = createEditSession(SHADERS, renderer, SHADER_IDS);
const perf = createPerfOverlay(renderer.gl);

let debug = 0;

transport.play();

function frame(now) {
  const beat = transport.beat();
  const sampled = sampleTimeline(TIMELINE, beat);
  let shaderId;
  let values;

  if (edit.isOn()) {
    shaderId = edit.activeShaderId();
    renderer.setActive(shaderId);
    values = edit.getValuesForActiveShader();
  } else {
    shaderId = sampled.shaderId;
    renderer.setActive(shaderId);
    values = sampled.values;
    edit.syncShaderIndexTo(shaderId);
  }

  perf.beginGpu();
  renderer.draw(values, transport.currentTime, debug);
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
  if (e.key === "k" || e.key === "K") kick();
  if (e.key === "b" || e.key === "B") bassKey();
  if (e.key === "h" || e.key === "H") hihat();
  if (e.key === "s" || e.key === "S") snare();
  if (e.key === "a" || e.key === "A") toggleAmen(TIMELINE.bpm);
  if (e.key === "m" || e.key === "M") edit.toggle(!edit.isOn());
  if (e.code === "Space") {
    e.preventDefault();
    if (transport.paused) transport.play();
    else transport.pause();
  }
});
