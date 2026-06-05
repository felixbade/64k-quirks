const BUDGET_MS = 1000 / 60;
const HISTORY_LEN = 120;
const GRAPH_MAX_MS = BUDGET_MS * 1.5;

export function createPerfOverlay(gl) {
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");

  const overlay = document.createElement("canvas");
  overlay.style.cssText =
    "position:fixed;top:8px;left:8px;pointer-events:none;z-index:10;";
  document.body.appendChild(overlay);
  const ctx = overlay.getContext("2d");

  const history = new Float32Array(HISTORY_LEN);
  let historyIdx = 0;
  let historyCount = 0;

  let activeQuery = null;
  const pendingQueries = [];

  let gpuMs = null;
  let minGpu = Infinity;
  let maxGpu = 0;
  let sumGpu = 0;
  let gpuSampleCount = 0;

  let visible = true;
  let lastFrameTime = performance.now();
  let fps = 0;

  const W = 280;
  const H = 155;

  function beginGpu() {
    if (ext) {
      activeQuery = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, activeQuery);
    }
  }

  function endGpu() {
    if (ext && activeQuery) {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pendingQueries.push(activeQuery);
      activeQuery = null;
      return;
    }

    // Fallback: stall GPU for one accurate sample per frame.
    const t0 = performance.now();
    gl.finish();
    recordGpu(performance.now() - t0);
  }

  function recordGpu(ms) {
    gpuMs = ms;
    history[historyIdx] = ms;
    historyIdx = (historyIdx + 1) % HISTORY_LEN;
    historyCount = Math.min(historyCount + 1, HISTORY_LEN);
    minGpu = Math.min(minGpu, ms);
    maxGpu = Math.max(maxGpu, ms);
    sumGpu += ms;
    gpuSampleCount++;
  }

  function pollGpu() {
    if (!ext || pendingQueries.length === 0) return;

    if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
      for (const q of pendingQueries) gl.deleteQuery(q);
      pendingQueries.length = 0;
      return;
    }

    const q = pendingQueries[0];
    if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return;

    recordGpu(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
    gl.deleteQuery(q);
    pendingQueries.shift();
  }

  function update(now) {
    const dt = now - lastFrameTime;
    lastFrameTime = now;
    if (dt > 0) fps = 1000 / dt;
    pollGpu();
    if (!visible) return;
    draw();
  }

  function draw() {
    overlay.width = W;
    overlay.height = H;

    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, W, H);

    const avgGpu = gpuSampleCount > 0 ? sumGpu / gpuSampleCount : 0;
    const overBudget = gpuMs !== null && gpuMs > BUDGET_MS;
    const marginPct =
      gpuMs !== null ? Math.abs((1 - gpuMs / BUDGET_MS) * 100) : null;

    ctx.font = "11px monospace";
    let y = 14;

    if (gpuMs !== null) {
      ctx.fillStyle = overBudget ? "#f55" : gpuMs > BUDGET_MS * 0.8 ? "#fa4" : "#5f5";
      const marginLabel = overBudget
        ? `-${marginPct.toFixed(0)}% over`
        : `+${marginPct.toFixed(0)}% headroom`;
      ctx.fillText(`GPU ${gpuMs.toFixed(2)} ms  ${marginLabel}`, 8, y);
      y += 14;
      ctx.fillStyle = "#888";
      ctx.fillText(
        `min ${minGpu.toFixed(2)}  avg ${avgGpu.toFixed(2)}  max ${maxGpu.toFixed(2)} ms`,
        8,
        y,
      );
    } else {
      ctx.fillStyle = "#888";
      ctx.fillText("GPU ...", 8, y);
      y += 14;
    }

    y += 4;
    ctx.fillStyle = "#666";
    const mode = ext ? "timer query" : "sync est";
    ctx.fillText(`FPS ${fps.toFixed(0)} (vsync)  [${mode}]`, 8, y);

    const gx = 8;
    const gy = y + 10;
    const gw = W - 16;
    const gh = 48;

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(gx, gy, gw, gh);

    const budgetY = gy + gh - (BUDGET_MS / GRAPH_MAX_MS) * gh;
    ctx.strokeStyle = "rgba(255,80,80,0.7)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(gx, budgetY);
    ctx.lineTo(gx + gw, budgetY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255,80,80,0.5)";
    ctx.font = "9px monospace";
    ctx.fillText("60fps", gx + gw - 32, budgetY - 3);

    if (historyCount > 1) {
      ctx.strokeStyle = "#5af";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < historyCount; i++) {
        const idx = (historyIdx - historyCount + i + HISTORY_LEN) % HISTORY_LEN;
        const x = gx + (i / (HISTORY_LEN - 1)) * gw;
        const v = Math.min(history[idx], GRAPH_MAX_MS);
        const py = gy + gh - (v / GRAPH_MAX_MS) * gh;
        if (i === 0) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      }
      ctx.stroke();
    }
  }

  function toggle() {
    visible = !visible;
    overlay.style.display = visible ? "block" : "none";
  }

  function reset() {
    minGpu = Infinity;
    maxGpu = 0;
    sumGpu = 0;
    gpuSampleCount = 0;
    historyCount = 0;
    historyIdx = 0;
  }

  return { beginGpu, endGpu, update, toggle, reset };
}
