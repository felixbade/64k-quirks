import frag from "./frag.glsl";

export const mandelbox = {
  id: "mandelbox",
  frag,
  resolution: [1920 / 2, 1080 / 2],
  defaults: {
    scale: -1.5,
    minRadius: 0.5,
    fixedRadius: 1.0,
    foldLimit: 1.0,
    size: 2.5,
    cameraX: 0.0,
    cameraY: 0.0,
    cameraZ: -5.5,
    cameraYaw: 0.0,
    cameraPitch: 0.0,
    cameraZoom: 1.5,
  },
  cacheLocs(gl, program) {
    return {
      u_mbScale: gl.getUniformLocation(program, "u_mbScale"),
      u_mbMinRadius: gl.getUniformLocation(program, "u_mbMinRadius"),
      u_mbFixedRadius: gl.getUniformLocation(program, "u_mbFixedRadius"),
      u_mbFoldLimit: gl.getUniformLocation(program, "u_mbFoldLimit"),
      u_mbSize: gl.getUniformLocation(program, "u_mbSize"),
      u_camPos: gl.getUniformLocation(program, "u_camPos"),
      u_camDir: gl.getUniformLocation(program, "u_camDir"),
      u_camZoom: gl.getUniformLocation(program, "u_camZoom"),
    };
  },
  apply(gl, locs, v) {
    gl.uniform1f(locs.u_mbScale, v.scale);
    gl.uniform1f(locs.u_mbMinRadius, v.minRadius);
    gl.uniform1f(locs.u_mbFixedRadius, v.fixedRadius);
    gl.uniform1f(locs.u_mbFoldLimit, v.foldLimit);
    gl.uniform1f(locs.u_mbSize, v.size);

    // Forward direction from yaw/pitch (yaw around Y, pitch up/down).
    const cosYaw = Math.cos(v.cameraYaw);
    const sinYaw = Math.sin(v.cameraYaw);
    const cosPitch = Math.cos(v.cameraPitch);
    const sinPitch = Math.sin(v.cameraPitch);
    gl.uniform3f(locs.u_camPos, v.cameraX, v.cameraY, v.cameraZ);
    gl.uniform3f(locs.u_camDir, sinYaw * cosPitch, sinPitch, cosYaw * cosPitch);
    gl.uniform1f(locs.u_camZoom, v.cameraZoom);
  },
  explorerHandlers: {
    // dx: fold scale (the dominant shape control); dy: overall size.
    scaleSize: (s, { dx, dy }) => ({
      scale: s.scale + dx / 500,
      size: Math.max(0.1, s.size - dy / 100),
    }),
    // dx: inner sphere-fold radius; dy: outer sphere-fold radius.
    radii: (s, { dx, dy }) => ({
      minRadius: Math.max(0.01, s.minRadius + dx / 500),
      fixedRadius: Math.max(0.01, s.fixedRadius + dy / 500),
    }),
    // dy: box-fold clamp limit.
    foldLimit: (s, { dy }) => ({
      foldLimit: Math.max(0.1, s.foldLimit + dy / 500),
    }),
    // dx: yaw (look left/right); dy: pitch (look up/down).
    cameraDirection: (s, { dx, dy }) => ({
      cameraYaw: s.cameraYaw - dx / 500,
      cameraPitch: s.cameraPitch - dy / 500,
    }),
    // Pan in the camera's view plane (dx: right/left; dy: up/down).
    cameraXY: (s, { dx, dy }) => {
      const cosYaw = Math.cos(s.cameraYaw);
      const sinYaw = Math.sin(s.cameraYaw);
      const cosPitch = Math.cos(s.cameraPitch);
      const sinPitch = Math.sin(s.cameraPitch);
      return {
        cameraX: s.cameraX - (dx / 300) * cosYaw + (dy / 300) * sinPitch * sinYaw,
        cameraY: s.cameraY - (dy / 300) * cosPitch,
        cameraZ: s.cameraZ + (dx / 300) * sinYaw + (dy / 300) * sinPitch * cosYaw,
      };
    },
    // dy: dolly along the view direction; dx: zoom (focal length).
    cameraZZoom: (s, { dx, dy }) => {
      const cosYaw = Math.cos(s.cameraYaw);
      const sinYaw = Math.sin(s.cameraYaw);
      const cosPitch = Math.cos(s.cameraPitch);
      const sinPitch = Math.sin(s.cameraPitch);
      const dirX = sinYaw * cosPitch;
      const dirY = sinPitch;
      const dirZ = cosYaw * cosPitch;
      return {
        cameraX: s.cameraX - (dy / 300) * dirX,
        cameraY: s.cameraY - (dy / 300) * dirY,
        cameraZ: s.cameraZ - (dy / 300) * dirZ,
        cameraZoom: s.cameraZoom * Math.exp(dx / 1000),
      };
    },
  },
};
