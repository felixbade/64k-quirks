import frag from "./tunnel.frag.glsl";
import { generateNoiseData } from "./tunnel-noise.js";

const TWIST_STEP = 1 / 8;

function quantizeTwist(twist) {
  return Math.round(twist / TWIST_STEP) * TWIST_STEP;
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Drag hue (dx) + lightness (dy), scroll saturation (sdy).
function dragHsl([h, s, l], { dx, dy, sdy }) {
  return [h + dx / 4, clamp(s - sdy / 50, 0, 100), clamp(l - dy / 10, 0, 100)];
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
    blueDotSize: 8.0,
    pinkDotSize: 12.0,
    // Riso ink palette as HSL [hue°, sat%, light%]
    paper: [44, 60, 87.5],
    pink: [330, 100, 63.5],
    blue: [208, 100, 39],
  },
  cacheLocs(gl, program) {
    return {
      u_speed: gl.getUniformLocation(program, "u_speed"),
      u_twist: gl.getUniformLocation(program, "u_twist"),
      u_rotSpeed: gl.getUniformLocation(program, "u_rotSpeed"),
      u_blueDotSize: gl.getUniformLocation(program, "u_blueDotSize"),
      u_pinkDotSize: gl.getUniformLocation(program, "u_pinkDotSize"),
      u_paper: gl.getUniformLocation(program, "u_paper"),
      u_pink: gl.getUniformLocation(program, "u_pink"),
      u_blue: gl.getUniformLocation(program, "u_blue"),
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
    gl.uniform1f(locs.u_blueDotSize, v.blueDotSize);
    gl.uniform1f(locs.u_pinkDotSize, v.pinkDotSize);
    gl.uniform3fv(locs.u_paper, hslToRgb(v.paper));
    gl.uniform3fv(locs.u_pink, hslToRgb(v.pink));
    gl.uniform3fv(locs.u_blue, hslToRgb(v.blue));
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
      blueDotSize: Math.max(1, s.blueDotSize + dx / 100),
      pinkDotSize: Math.max(1, s.pinkDotSize - dy / 100),
    }),
    paperColor: (s, input) => ({ paper: dragHsl(s.paper, input) }),
    pinkColor: (s, input) => ({ pink: dragHsl(s.pink, input) }),
    blueColor: (s, input) => ({ blue: dragHsl(s.blue, input) }),
  },
};
