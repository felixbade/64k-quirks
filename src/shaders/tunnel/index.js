import frag from "./frag.glsl";
import { generateNoiseData } from "./noise.js";

const TWIST_STEP = 1 / 8;

function quantizeTwist(twist) {
  return Math.round(twist / TWIST_STEP) * TWIST_STEP;
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Drag hue (dx) + lightness (dy), scroll saturation (sdy). Operates on the
// flat `${name}Hue|Sat|Lig` params and returns just those three keys.
function dragHsl(name, s, { dx, dy, sdx, sdy }) {

  let hue = s[`${name}Hue`];
  let sat = s[`${name}Sat`];
  let lig = s[`${name}Lig`];

  // dx/dy: tone (lightess + saturation)
  lig -= dy / 10;
  sat += dx / 10;

  // sdx/sdy: chromacity (hue + saturation)
  let redness = Math.cos(hue * Math.PI / 180) * sat / 100;
  let greenness = Math.sin(hue * Math.PI / 180) * sat / 100;
  redness += sdx / 400;
  greenness += sdy / 400;
  sat = Math.sqrt(redness * redness + greenness * greenness) * 100;
  hue = Math.atan2(greenness, redness) * 180 / Math.PI;

  hue = (hue % 360 + 360) % 360;
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

export const tunnel = {
  id: "tunnel",
  frag,
  resolution: [1920, 1080],
  defaults: {
    speed: 1.2,
    twist: 0.375,
    rotSpeed: 0.0,
    spiralDotSize: 8.0,
    edgeDotSize: 12.0,
    // Riso ink palette as flat HSL params (hue°, sat%, light%)
    bgHue: 44,
    bgSat: 60,
    bgLig: 87.5,
    edgeHue: 208,
    edgeSat: 100,
    edgeLig: 39,
    spiralHue: 330,
    spiralSat: 100,
    spiralLig: 63.5,
  },
  cacheLocs(gl, program) {
    return {
      u_speed: gl.getUniformLocation(program, "u_speed"),
      u_twist: gl.getUniformLocation(program, "u_twist"),
      u_rotSpeed: gl.getUniformLocation(program, "u_rotSpeed"),
      u_spiralDotSize: gl.getUniformLocation(program, "u_spiralDotSize"),
      u_edgeDotSize: gl.getUniformLocation(program, "u_edgeDotSize"),
      u_bg: gl.getUniformLocation(program, "u_bg"),
      u_edge: gl.getUniformLocation(program, "u_edge"),
      u_spiral: gl.getUniformLocation(program, "u_spiral"),
      u_noise: gl.getUniformLocation(program, "u_noise"),
    };
  },
  init(gl, program, locs) {
    const { data, size } = generateNoiseData();
    const noiseTex = gl.createTexture();

    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, size, size, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(locs.u_noise, 0);

    return { noiseTex };
  },
  apply(gl, locs, v, res) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, res.noiseTex);
    gl.uniform1f(locs.u_speed, v.speed);
    gl.uniform1f(locs.u_twist, quantizeTwist(v.twist));
    gl.uniform1f(locs.u_rotSpeed, v.rotSpeed);
    gl.uniform1f(locs.u_spiralDotSize, v.spiralDotSize);
    gl.uniform1f(locs.u_edgeDotSize, v.edgeDotSize);
    gl.uniform3fv(locs.u_bg, hslToRgb([v.bgHue, v.bgSat, v.bgLig]));
    gl.uniform3fv(locs.u_edge, hslToRgb([v.edgeHue, v.edgeSat, v.edgeLig]));
    gl.uniform3fv(locs.u_spiral, hslToRgb([v.spiralHue, v.spiralSat, v.spiralLig]));
  },
  explorerHandlers: {
    speedTwist: (s, { dx, dy }) => ({
      speed: s.speed + dx / 500,
      twist: quantizeTwist(s.twist - dy / 300),
    }),
    rotSpeed: (s, { dx }) => ({
      rotSpeed: s.rotSpeed + dx / 2000,
    }),
    dotSizes: (s, { dx, dy }) => ({
      spiralDotSize: Math.max(1, s.spiralDotSize + dx / 100),
      edgeDotSize: Math.max(1, s.edgeDotSize - dy / 100),
    }),
    bgColor: (s, input) => dragHsl("bg", s, input),
    edgeColor: (s, input) => dragHsl("edge", s, input),
    spiralColor: (s, input) => dragHsl("spiral", s, input),
  },
};
