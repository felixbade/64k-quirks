import frag from "./frag.glsl";

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Drag hue (dx) + lightness (dy), scroll saturation (sdx/sdy). Operates on the
// flat `${name}Hue|Sat|Lig` params and returns just those three keys.
function dragHsl(name, s, { dx, dy, sdx, sdy }) {
  let hue = s[`${name}Hue`];
  let sat = s[`${name}Sat`];
  let lig = s[`${name}Lig`];

  // dx/dy: tone (lightness + saturation)
  lig -= dy / 10;
  sat += dx / 10;

  // sdx/sdy: chromacity (hue + saturation)
  let redness = Math.cos((hue * Math.PI) / 180) * sat / 100;
  let greenness = Math.sin((hue * Math.PI) / 180) * sat / 100;
  redness += sdx / 400;
  greenness += sdy / 400;
  sat = Math.sqrt(redness * redness + greenness * greenness) * 100;
  hue = (Math.atan2(greenness, redness) * 180) / Math.PI;

  hue = ((hue % 360) + 360) % 360;
  sat = clamp(sat, 0, 100);
  lig = clamp(lig, 0, 100);

  return {
    [`${name}Hue`]: Math.round(hue, 1),
    [`${name}Sat`]: Math.round(sat, 1),
    [`${name}Lig`]: Math.round(lig, 1),
  };
}

// HSL (h in degrees, s/l in percent) -> linear RGB triple in [0, 1].
function hslToRgb([h, s, l]) {
  h = (((h % 360) + 360) % 360) / 360;
  s /= 100;
  l /= 100;
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)];
}

export const grid = {
  id: "grid",
  frag,
  resolution: [1920, 1080],
  defaults: {
    gridX: 0.2,
    gridY: 0.2,
    thickX: 0.01,
    thickY: 0.01,
    // pan-zoom-rotate
    centerX: 0.0,
    centerY: 0.0,
    zoomLog: 0.0,
    rotation: 0.0,
    // perlin coordinate warp
    noiseStrength: 0.1,
    noiseSize: 1.0,
    noiseDecay: 0.5,
    noiseZ: 0.0,
    // white lines on a black background, as flat HSL params (hue°, sat%, light%)
    lineHue: 0,
    lineSat: 0,
    lineLig: 100,
    bgHue: 0,
    bgSat: 0,
    bgLig: 0,
  },
  cacheLocs(gl, program) {
    return {
      u_gridLine: gl.getUniformLocation(program, "u_gridLine"),
      u_gridBg: gl.getUniformLocation(program, "u_gridBg"),
      u_gridSize: gl.getUniformLocation(program, "u_gridSize"),
      u_gridThick: gl.getUniformLocation(program, "u_gridThick"),
      u_center: gl.getUniformLocation(program, "u_center"),
      u_zoom: gl.getUniformLocation(program, "u_zoom"),
      u_rot: gl.getUniformLocation(program, "u_rot"),
      u_noiseStrength: gl.getUniformLocation(program, "u_noiseStrength"),
      u_noiseSize: gl.getUniformLocation(program, "u_noiseSize"),
      u_noiseDecay: gl.getUniformLocation(program, "u_noiseDecay"),
      u_noiseZ: gl.getUniformLocation(program, "u_noiseZ"),
    };
  },
  apply(gl, locs, v) {
    gl.uniform3fv(locs.u_gridLine, hslToRgb([v.lineHue, v.lineSat, v.lineLig]));
    gl.uniform3fv(locs.u_gridBg, hslToRgb([v.bgHue, v.bgSat, v.bgLig]));
    gl.uniform2f(locs.u_gridSize, v.gridX, v.gridY);
    gl.uniform2f(locs.u_gridThick, v.thickX, v.thickY);
    gl.uniform2f(locs.u_center, v.centerX, v.centerY);
    gl.uniform1f(locs.u_zoom, Math.pow(2, v.zoomLog));
    gl.uniform1f(locs.u_rot, v.rotation);
    gl.uniform1f(locs.u_noiseStrength, v.noiseStrength);
    gl.uniform1f(locs.u_noiseSize, v.noiseSize);
    gl.uniform1f(locs.u_noiseDecay, v.noiseDecay);
    gl.uniform1f(locs.u_noiseZ, v.noiseZ);
  },
  explorerHandlers: {
    // Drag pans, scroll zooms (sdy) and rotates (sdx).
    pan: (s, { dx, dy, sdx, sdy }) => {
      const zoom = Math.pow(2, s.zoomLog);
      dx *= -0.002 / zoom;
      dy *= 0.002 / zoom;
      const cos = Math.cos(s.rotation);
      const sin = Math.sin(s.rotation);
      return {
        centerX: s.centerX + dx * cos + dy * sin,
        centerY: s.centerY - dx * sin + dy * cos,
        zoomLog: s.zoomLog - sdy * 0.003,
        rotation: s.rotation + sdx * 0.002,
      };
    },
    // dx/dy: cell size per axis; sdx/sdy: line thickness per axis. Inputs are
    // rotated by `rotation` so dragging aligns with the on-screen grid axes.
    sizeThickness: (s, { dx, dy, sdx, sdy }) => {
      const cos = Math.cos(s.rotation);
      const sin = Math.sin(s.rotation);
      const rdx = dx * cos - dy * sin;
      const rdy = dx * sin + dy * cos;
      const rsdx = sdx * cos - sdy * sin;
      const rsdy = sdx * sin + sdy * cos;
      return {
        gridX: Math.max(0.005, s.gridX * Math.exp(rdx / 500)),
        gridY: Math.max(0.005, s.gridY * Math.exp(-rdy / 500)),
        thickX: Math.max(0.0005, s.thickX * Math.exp(-rsdx / 300)),
        thickY: Math.max(0.0005, s.thickY * Math.exp(rsdy / 300)),
      };
    },
    lineColor: (s, input) => dragHsl("line", s, input),
    bgColor: (s, input) => dragHsl("bg", s, input),
    // dx: warp strength; dy: feature size; sdy: per-octave decay; sdx: z offset.
    noise: (s, { dx, dy, sdx, sdy }) => ({
      noiseStrength: Math.max(0, s.noiseStrength * Math.exp(sdx / 300)),
      noiseSize: Math.max(0.01, s.noiseSize * Math.exp(-dy / 300)),
      noiseDecay: clamp(s.noiseDecay + sdy * 0.002, 0, 1),
      noiseZ: s.noiseZ + dx * 0.001,
    }),
  },
};
