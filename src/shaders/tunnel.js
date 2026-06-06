import frag from "./tunnel.frag.glsl";

export const tunnel = {
  id: "tunnel",
  frag,
  resolution: [640, 360],
  defaults: {
    speed: 1.2,
    twist: 0.4,
  },
  cacheLocs(gl, program) {
    return {
      u_speed: gl.getUniformLocation(program, "u_speed"),
      u_twist: gl.getUniformLocation(program, "u_twist"),
    };
  },
  apply(gl, locs, v) {
    gl.uniform1f(locs.u_speed, v.speed);
    gl.uniform1f(locs.u_twist, v.twist);
  },
  explorerHandlers: {
    speedTwist: (s, { dx, dy }) => ({
      speed: s.speed + dx / 500,
      twist: s.twist - dy / 300,
    }),
  },
};
