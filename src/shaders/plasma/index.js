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
  let redness = (Math.cos((hue * Math.PI) / 180) * sat) / 100;
  let greenness = (Math.sin((hue * Math.PI) / 180) * sat) / 100;
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

export const plasma = {
  id: "plasma",
  frag,
  resolution: [1920, 1080],
  defaults: {
    scale: 3.0,
    speed: 1.0,
    warp: 0.6,
    // the two plasma colors, as flat HSL params (hue°, sat%, light%)
    aHue: 280,
    aSat: 90,
    aLig: 55,
    bHue: 30,
    bSat: 100,
    bLig: 60,
    cubeSize: 0.8,
    ior: 1.45,
    dispersion: 0.04,
    rotSpeed: 0.3,
    reflect: 1.0,
    tintHue: 190,
    tintSat: 20,
    tintLig: 92,
  },
  cacheLocs(gl, program) {
    return {
      u_colorA: gl.getUniformLocation(program, "u_colorA"),
      u_colorB: gl.getUniformLocation(program, "u_colorB"),
      u_scale: gl.getUniformLocation(program, "u_scale"),
      u_speed: gl.getUniformLocation(program, "u_speed"),
      u_warp: gl.getUniformLocation(program, "u_warp"),
      u_cubeSize: gl.getUniformLocation(program, "u_cubeSize"),
      u_ior: gl.getUniformLocation(program, "u_ior"),
      u_dispersion: gl.getUniformLocation(program, "u_dispersion"),
      u_rotSpeed: gl.getUniformLocation(program, "u_rotSpeed"),
      u_reflect: gl.getUniformLocation(program, "u_reflect"),
      u_glassTint: gl.getUniformLocation(program, "u_glassTint"),
    };
  },
  apply(gl, locs, v) {
    const d = plasma.defaults;
    gl.uniform3fv(locs.u_colorA, hslToRgb([v.aHue, v.aSat, v.aLig]));
    gl.uniform3fv(locs.u_colorB, hslToRgb([v.bHue, v.bSat, v.bLig]));
    gl.uniform1f(locs.u_scale, v.scale);
    gl.uniform1f(locs.u_speed, v.speed);
    gl.uniform1f(locs.u_warp, v.warp);
    gl.uniform1f(locs.u_cubeSize, v.cubeSize ?? d.cubeSize);
    gl.uniform1f(locs.u_ior, v.ior ?? d.ior);
    gl.uniform1f(locs.u_dispersion, v.dispersion ?? d.dispersion);
    gl.uniform1f(locs.u_rotSpeed, v.rotSpeed ?? d.rotSpeed);
    gl.uniform1f(locs.u_reflect, v.reflect ?? d.reflect);
    gl.uniform3fv(locs.u_glassTint, hslToRgb([v.tintHue ?? d.tintHue, v.tintSat ?? d.tintSat, v.tintLig ?? d.tintLig]));
  },
  explorerHandlers: {
    // dx: spatial scale (zoom); dy: animation speed.
    scaleSpeed: (s, { dx, dy }) => ({
      scale: Math.max(0.1, s.scale * Math.exp(dx / 500)),
      speed: s.speed - dy / 300,
    }),
    // dx: domain-warp strength (how much the field churns and folds).
    warp: (s, { dx }) => ({
      warp: Math.max(0, s.warp + dx / 300),
    }),
    colorA: (s, input) => dragHsl("a", s, input),
    colorB: (s, input) => dragHsl("b", s, input),
  },
};
