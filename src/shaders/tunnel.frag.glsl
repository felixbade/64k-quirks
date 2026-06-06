#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_twist;
uniform sampler2D u_noise;

out vec4 fragColor;

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float z = 1.0 / max(r, 0.001) + u_time * u_speed;
  vec2 noiseUv = vec2(a / 6.28318530718 + 0.5, fract(z * 0.08));
  float noise = texture(u_noise, noiseUv).r;
  float bands = sin(z * 6.0 + a * u_twist * 8.0 + (noise - 0.5) * 4.0);
  vec3 col = vec3(0.5 + 0.5 * bands, 0.2 + 0.3 * sin(z * 3.0 + noise * 2.0), 0.6 + 0.4 * cos(a * 2.0));
  col *= 0.75 + noise * 0.5;
  col *= smoothstep(0.0, 0.15, r);
  fragColor = vec4(col, 1.0);
}
