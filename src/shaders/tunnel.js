import frag from "./tunnel.frag.glsl";
import { generateNoiseData } from "./tunnel-noise.js";

const TWIST_STEP = 1 / 8;

function quantizeTwist(twist) {
  return Math.round(twist / TWIST_STEP) * TWIST_STEP;
}

export const tunnel = {
  id: "tunnel",
  frag,
  resolution: [1920, 1080],
  defaults: {
    speed: 1.2,
    twist: 0.375,
  },
  cacheLocs(gl, program) {
    return {
      u_speed: gl.getUniformLocation(program, "u_speed"),
      u_twist: gl.getUniformLocation(program, "u_twist"),
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
  },
  explorerHandlers: {
    speedTwist: (s, { dx, dy }) => ({
      speed: s.speed + dx / 500,
      twist: quantizeTwist(s.twist - dy / 300),
    }),
  },
};
