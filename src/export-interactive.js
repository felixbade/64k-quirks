import { createRenderer } from "./gl/renderer.js";
import { SHADERS } from "./shaders/index.js";
import { TIMELINE } from "./timeline.js";
import { createEditSession } from "./edit.js";

const renderer = createRenderer(SHADERS);
renderer.warmup();

// Unique scenes pulled from the timeline (first appearance wins). No music,
// no auto-advance: you step through them by hand and tweak with pflow.
const scenes = [];
const seen = new Set();
for (const seg of TIMELINE.segments) {
  if (seen.has(seg.sceneName)) continue;
  seen.add(seg.sceneName);
  scenes.push({ shaderId: seg.shader, sceneName: seg.sceneName, values: { ...seg.params } });
}

let sceneIndex = 0;
let sample = scenes[sceneIndex];

const edit = createEditSession(SHADERS, () => sample);

// Some shaders animate on u_time, so we keep our own clock that only advances
// while "playing". Space toggles it.
let playing = false;
let time = 0;
let lastNow = null;

function frame(now) {
  if (lastNow !== null && playing) time += (now - lastNow) / 1000;
  lastNow = now;

  renderer.setActive(sample.shaderId);
  edit.setActiveShader(sample.shaderId, sample.sceneName);
  const overrides = edit.getOverridesForShader(sample.shaderId);
  renderer.draw({ ...sample.values, ...overrides }, time);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener("keydown", (e) => {
  const { canvas } = renderer;
  if (e.key === "f" || e.key === "F") {
    if (document.fullscreenElement) document.exitFullscreen();
    else canvas.requestFullscreen();
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    playing = !playing;
    return;
  }
  // ArrowUp/Down + Enter + digits + E + Backspace belong to pflow; left/right
  // are free, so we use them to step scenes.
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    const n = scenes.length;
    const dir = e.key === "ArrowRight" ? 1 : -1;
    sceneIndex = (((sceneIndex + dir) % n) + n) % n;
    sample = scenes[sceneIndex];
  }
});
