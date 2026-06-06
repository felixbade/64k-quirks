#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_twist;

out vec4 fragColor;

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float z = 1.0 / max(r, 0.001) + u_time * u_speed;
  float bands = sin(z * 6.0 + a * u_twist * 8.0);
  vec3 col = vec3(0.5 + 0.5 * bands, 0.2 + 0.3 * sin(z * 3.0), 0.6 + 0.4 * cos(a * 2.0));
  col *= smoothstep(0.0, 0.15, r);
  fragColor = vec4(col, 1.0);
}
