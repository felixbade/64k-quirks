import frag from "./frag.glsl";

export const kifs = {
  id: "kifs",
  frag,
  resolution: [1920 / 3, 1080 / 3],
  defaults: {
    scale: 1.9,
    size: 2.0,
    offsetX: 1.0,
    offsetY: 0.85,
    offsetZ: 0.6,
    rotX: 0.5,
    rotY: 0.8,
    costScale: 360,
  },
  cacheLocs(gl, program) {
    return {
      u_costScale: gl.getUniformLocation(program, "u_costScale"),
      u_kifsScale: gl.getUniformLocation(program, "u_kifsScale"),
      u_kifsOffset: gl.getUniformLocation(program, "u_kifsOffset"),
      u_kifsSize: gl.getUniformLocation(program, "u_kifsSize"),
      u_kifsRot: gl.getUniformLocation(program, "u_kifsRot"),
    };
  },
  apply(gl, locs, v) {
    gl.uniform1f(locs.u_costScale, v.costScale);
    gl.uniform1f(locs.u_kifsScale, v.scale);
    gl.uniform3f(locs.u_kifsOffset, v.offsetX, v.offsetY, v.offsetZ);
    gl.uniform1f(locs.u_kifsSize, v.size);
    gl.uniform2f(locs.u_kifsRot, v.rotX, v.rotY);
  },
  explorerHandlers: {
    scaleSize: (s, { dx, dy }) => ({
      scale: s.scale * Math.exp(dx / 500),
      size: s.size - dy / 100,
    }),
    offsetXY: (s, { dx, dy }) => ({
      offsetX: s.offsetX - dx / 300,
      offsetY: s.offsetY + dy / 300,
    }),
    offsetZ: (s, { dy }) => ({
      offsetZ: s.offsetZ + dy / 300,
    }),
    rotation: (s, { dx, dy }) => ({
      rotY: s.rotY - dx / 500,
      rotX: s.rotX - dy / 500,
    }),
  },
};
