#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_gridLine;    // grid line color
uniform vec3 u_gridBg;      // background color
uniform vec2 u_gridSize;    // cell size in uv units (x, y)
uniform vec2 u_gridThick;   // line thickness in uv units, per axis (x, y)
uniform vec2 u_center;      // pan offset
uniform float u_zoom;       // zoom factor
uniform float u_rot;        // rotation angle (radians)

out vec4 fragColor;

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;

  // Pan-zoom-rotate the sampling coordinates.
  uv /= u_zoom;
  float c = cos(u_rot), s = sin(u_rot);
  uv = mat2(c, -s, s, c) * uv;
  uv += u_center;

  // Coordinates in grid cells; lines sit on integer boundaries.
  vec2 size = max(u_gridSize, vec2(1e-4));
  vec2 g = uv / size;
  // Distance to nearest line, converted back to uv units so thickness stays
  // constant regardless of cell size.
  vec2 d = abs(fract(g + 0.5) - 0.5) * size;
  vec2 w = fwidth(uv); // screen-space derivative for AA

  vec2 ht = u_gridThick * 0.5;
  float lx = 1.0 - smoothstep(ht.x - w.x, ht.x + w.x, d.x);
  float ly = 1.0 - smoothstep(ht.y - w.y, ht.y + w.y, d.y);
  float line = max(lx, ly);

  vec3 col = mix(u_gridBg, u_gridLine, line);
  fragColor = vec4(col, 1.0);
}
