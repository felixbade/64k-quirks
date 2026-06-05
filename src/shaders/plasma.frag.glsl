#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

out vec4 fragColor;

// Simple plasma placeholder.
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;

  float t = u_time;
  float v = 0.0;
  v += sin((p.x * 6.0) + t);
  v += sin((p.y * 6.0 + t) * 0.5);
  v += sin((p.x * 6.0 + p.y * 6.0 + t) * 0.5);
  float cx = p.x + 0.5 * sin(t * 0.3);
  float cy = p.y + 0.5 * cos(t * 0.4);
  v += sin(sqrt(cx * cx + cy * cy) * 8.0 + t);

  v *= 0.5;
  vec3 col = vec3(
    sin(v * 3.14159) * 0.5 + 0.5,
    sin(v * 3.14159 + 2.094) * 0.5 + 0.5,
    sin(v * 3.14159 + 4.188) * 0.5 + 0.5
  );

  fragColor = vec4(col, 1.0);
}
