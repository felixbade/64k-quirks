import { createRenderer } from "./gl/renderer.js";
import { SHADERS, SHADER_IDS } from "./shaders/registry.js";
import { TIMELINE, sampleTimeline } from "./timeline.js";
import { createTransport } from "./transport.js";
import { createEditSession } from "./edit.js";
import { createPerfOverlay } from "./perf.js";
import { seekMusic, startMusic, stopMusic } from "./audio.js";

const renderer = createRenderer(SHADERS);
const transport = createTransport(TIMELINE.bpm);
const edit = createEditSession(SHADERS, renderer, SHADER_IDS);
const perf = createPerfOverlay(renderer.gl);

let debug = 0;

document.body.appendChild(transport.element);
transport.player.addEventListener("play", () => startMusic(TIMELINE.bpm, transport.currentTime));
transport.player.addEventListener("pause", stopMusic);
transport.player.addEventListener("seek", (e) => seekMusic(TIMELINE.bpm, e.detail.time));
transport.player.addEventListener("end", stopMusic);

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
  if (e.key === "m" || e.key === "M") edit.toggle(!edit.isOn());
});
