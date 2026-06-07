import { createRenderer } from "./gl/renderer.js";
import { SHADERS } from "./shaders/index.js";
import { TIMELINE, sampleTimeline } from "./timeline.js";
import { startMusic, stopMusic, unlockAudio } from "./audio.js";

const DEMO_BARS = 64;
const DURATION = (DEMO_BARS * 4 * 60) / TIMELINE.bpm;
const renderer = createRenderer(SHADERS);
renderer.warmup();

let startAt = 0;
let playing = false;

const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
const playLabel = hasTouch ? "<kbd>Space</kbd> / <kbd>touch</kbd>" : "<kbd>Space</kbd>";
const overlay = document.createElement("div");
overlay.innerHTML = "<div><p><kbd>F</kbd> fullscreen</p><p>" + playLabel + " play</p></div>";
overlay.style.cssText =
  "position:fixed;inset:0;display:grid;place-items:center;background:#000;color:#fff;font:28px monospace;text-align:center;z-index:2";
const style = document.createElement("style");
style.textContent =
  "p{margin:1em}kbd{display:inline-block;min-width:2.5em;padding:.25em .45em;border-radius:.3em;background:#222;border:1px solid #444;color:#fff}";
document.head.appendChild(style);
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
    renderer.gl.clearColor(0, 0, 0, 1);
    renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT);
    return;
  }

  const sample = sampleTimeline(TIMELINE, (time * TIMELINE.bpm) / 60);
  renderer.setActive(sample.shaderId);
  renderer.draw(sample.values, time);
  requestAnimationFrame(frame);
}

function start() {
  if (playing) return;
  playing = true;
  unlockAudio();
  startMusic(TIMELINE.bpm, 0);
  overlay.remove();
  startAt = performance.now();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !playing) {
    e.preventDefault();
    start();
    return;
  }
  if (e.key === "f" || e.key === "F") {
    if (document.fullscreenElement) document.exitFullscreen();
    else renderer.canvas.requestFullscreen();
  }
});

function onPlayGesture(e) {
  if (playing) return;
  e.preventDefault();
  start();
}
overlay.addEventListener("pointerup", onPlayGesture);
overlay.addEventListener("click", onPlayGesture);
