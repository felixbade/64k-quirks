#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_twist;
uniform sampler2D u_noise;

out vec4 fragColor;

// Riso ink palette (translucent, multiply onto paper)
const vec3 PAPER = vec3(0.95, 0.91, 0.80);
const vec3 INK_PINK = vec3(1.0, 0.27, 0.64);
const vec3 INK_BLUE = vec3(0.0, 0.42, 0.78);

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

// Halftone dot coverage: 1.0 inside dot, 0.0 outside. Bigger dots for higher ink.
float halftone(vec2 frag, float angle, float scale, float ink) {
  vec2 q = rot(angle) * frag / scale;
  vec2 cell = fract(q) - 0.5;
  float d = length(cell);
  float radius = sqrt(clamp(ink, 0.0, 1.0)) * 0.72;
  return smoothstep(radius + 0.04, radius - 0.04, d);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float z = 1.0 / max(r, 0.001) + u_time * u_speed;
  vec2 noiseUv = vec2(a / 6.28318530718 + 0.5, fract(z * 0.08));
  float noise = texture(u_noise, noiseUv).r;
  float bands = sin(z * 6.0 + a * u_twist * 8.0 + (noise - 0.5) * 4.0);

  // Single posterized tone: 0 = deep, 1 = bright
  float tone = 0.5 + 0.5 * bands + (noise - 0.5) * 0.22 + 0.06 * sin(a * 2.0 + z * 0.4);
  tone = clamp(tone, 0.0, 1.0);
  tone = floor(tone * 3.0) / 3.0; // flat poster steps

  // Ink coverage: blue fills the shadows, pink the mid-tones, paper shows in highlights
  float blueInk = 1.0 - smoothstep(0.0, 0.5, tone);
  float pinkInk = 1.0 - smoothstep(0.25, 0.85, tone);

  // Slight ink misregistration for that printed charm
  vec2 frag = gl_FragCoord.xy;
  float blueDots = halftone(frag + vec2(1.5, -1.0), 0.26, 5.0, blueInk);
  float pinkDots = halftone(frag, 1.13, 5.0, pinkInk);

  vec3 col = PAPER;
  col = mix(col, col * INK_BLUE, blueDots);
  col = mix(col, col * INK_PINK, pinkDots);

  // Paper grain
  col *= 0.96 + noise * 0.08;

  col *= smoothstep(0.0, 0.12, r);
  fragColor = vec4(col, 1.0);
}
