import { createRenderer } from "./gl/renderer.js";
import { SHADERS } from "./shaders/index.js";
import { TIMELINE, sampleTimeline } from "./timeline.js";
import { startMusic, stopMusic } from "./audio.js";

const DEMO_BARS = 64;
const DURATION = (DEMO_BARS * 4 * 60) / TIMELINE.bpm;
const renderer = createRenderer(SHADERS);
renderer.warmup();

let startAt = 0;
let playing = false;

const overlay = document.createElement("button");
overlay.textContent = "start";
overlay.style.cssText =
  "position:fixed;inset:0;border:0;background:#000;color:#fff;font:32px monospace;cursor:pointer;z-index:2";
document.body.appendChild(overlay);

function currentTime(now) {
  return (now - startAt) / 1000;
}

function frame(now) {
  if (!playing) return;

  const time = currentTime(now);
  if (time >= DURATION) {
    stopMusic();
    playing = false;
    return;
  }

  const sample = sampleTimeline(TIMELINE, (time * TIMELINE.bpm) / 60);
  renderer.setActive(sample.shaderId);
  renderer.draw(sample.values, time);
  requestAnimationFrame(frame);
}

function start() {
  if (playing) return;
  overlay.remove();
  startAt = performance.now();
  playing = true;
  startMusic(TIMELINE.bpm, 0);
  requestAnimationFrame(frame);
}

overlay.addEventListener("click", start, { once: true });
window.addEventListener("keydown", (e) => {
  if (!playing) {
    start();
    return;
  }
  if (e.key === "f" || e.key === "F") {
    if (document.fullscreenElement) document.exitFullscreen();
    else renderer.canvas.requestFullscreen();
  }
});
