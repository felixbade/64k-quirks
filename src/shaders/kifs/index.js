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
    cameraX: 0.0,
    cameraY: 0.25,
    cameraZ: 3.2,
    cameraYaw: 3.141592653589793,
    cameraPitch: -0.07804555427071125,
    cameraZoom: 1.5,
    cameraOrbit: 1.0,
  },
  cacheLocs(gl, program) {
    return {
      u_kifsScale: gl.getUniformLocation(program, "u_kifsScale"),
      u_kifsOffset: gl.getUniformLocation(program, "u_kifsOffset"),
      u_kifsSize: gl.getUniformLocation(program, "u_kifsSize"),
      u_kifsRot: gl.getUniformLocation(program, "u_kifsRot"),
      u_camPos: gl.getUniformLocation(program, "u_camPos"),
      u_camDir: gl.getUniformLocation(program, "u_camDir"),
      u_camZoom: gl.getUniformLocation(program, "u_camZoom"),
      u_camOrbit: gl.getUniformLocation(program, "u_camOrbit"),
    };
  },
  apply(gl, locs, v) {
    gl.uniform1f(locs.u_kifsScale, v.scale);
    gl.uniform3f(locs.u_kifsOffset, v.offsetX, v.offsetY, v.offsetZ);
    gl.uniform1f(locs.u_kifsSize, v.size);
    gl.uniform2f(locs.u_kifsRot, v.rotX, v.rotY);
    const cameraYaw = v.cameraYaw ?? kifs.defaults.cameraYaw;
    const cameraPitch = v.cameraPitch ?? kifs.defaults.cameraPitch;
    const cosPitch = Math.cos(cameraPitch);
    gl.uniform3f(
      locs.u_camPos,
      v.cameraX ?? kifs.defaults.cameraX,
      v.cameraY ?? kifs.defaults.cameraY,
      v.cameraZ ?? kifs.defaults.cameraZ,
    );
    gl.uniform3f(
      locs.u_camDir,
      Math.sin(cameraYaw) * cosPitch,
      Math.sin(cameraPitch),
      Math.cos(cameraYaw) * cosPitch,
    );
    gl.uniform1f(locs.u_camZoom, v.cameraZoom ?? kifs.defaults.cameraZoom);
    gl.uniform1f(locs.u_camOrbit, v.cameraOrbit ?? kifs.defaults.cameraOrbit);
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
    cameraDirection: (s, { dx, dy }) => ({
      cameraYaw: s.cameraYaw - dx / 500,
      cameraPitch: s.cameraPitch - dy / 500,
      cameraOrbit: 0.0,
    }),
    cameraXY: (s, { dx, dy }) => {
      const cosYaw = Math.cos(s.cameraYaw);
      const sinYaw = Math.sin(s.cameraYaw);
      const cosPitch = Math.cos(s.cameraPitch);
      const sinPitch = Math.sin(s.cameraPitch);
      return {
        cameraX: s.cameraX - (dx / 300) * cosYaw + (dy / 300) * sinPitch * sinYaw,
        cameraY: s.cameraY - (dy / 300) * cosPitch,
        cameraZ: s.cameraZ + (dx / 300) * sinYaw + (dy / 300) * sinPitch * cosYaw,
        cameraOrbit: 0.0,
      };
    },
    cameraZZoom: (s, { dx, dy }) => {
      const sinYaw = Math.sin(s.cameraYaw);
      const cosPitch = Math.cos(s.cameraPitch);
      const sinPitch = Math.sin(s.cameraPitch);
      const dirX = sinYaw * cosPitch;
      const dirY = sinPitch;
      const dirZ = Math.cos(s.cameraYaw) * cosPitch;
      return {
        cameraX: s.cameraX - (dy / 300) * dirX,
        cameraY: s.cameraY - (dy / 300) * dirY,
        cameraZ: s.cameraZ - (dy / 300) * dirZ,
        cameraZoom: s.cameraZoom * Math.exp(dx / 1000),
        cameraOrbit: 0.0,
      };
    },
  },
};
