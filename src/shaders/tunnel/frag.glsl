#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_twist;
uniform float u_rotSpeed;
uniform float u_tightness;
uniform float u_noiseScale;
uniform float u_noiseWarp;
uniform float u_noiseTone;
uniform float u_noiseGrain;
uniform float u_spiralDotSize;
uniform float u_edgeDotSize;
uniform vec3 u_bg;
uniform vec3 u_edge;
uniform vec3 u_spiral;
uniform sampler2D u_noise;

out vec4 fragColor;

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
  uv = rot(u_time * u_rotSpeed) * uv;
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float z = u_tightness / max(r, 0.001) + u_time * u_speed;
  vec2 noiseUv = vec2(a / 6.28318530718 + 0.5, fract(z * u_noiseScale));
  float noise = texture(u_noise, noiseUv).r;
  float bands = sin(z * 6.0 + a * u_twist * 8.0 + (noise - 0.5) * u_noiseWarp);

  // Single posterized tone: 0 = deep, 1 = bright
  float tone = 0.5 + 0.5 * bands + (noise - 0.5) * u_noiseTone + 0.06 * sin(a * 2.0 + z * 0.4);
  tone = clamp(tone, 0.0, 1.0);
  tone = floor(tone * 3.0) / 3.0; // flat poster steps

  // Ink coverage: spiral fills the shadows, edge the mid-tones, bg shows in highlights
  float spiralInk = 1.0 - smoothstep(0.0, 0.5, tone);
  float edgeInk = 1.0 - smoothstep(0.25, 0.85, tone);

  // Slight ink misregistration for that printed charm.
  // Grid spins CCW at second-hand speed: one revolution per minute.
  vec2 frag = gl_FragCoord.xy - u_resolution.xy * 0.5;
  float spin = u_time * (6.28318530718 / 180.0);
  float spiralDots = halftone(frag + vec2(3.0, -2.0), 0.26 + spin, u_spiralDotSize, spiralInk);
  float edgeDots = halftone(frag, 1.13 + spin, u_edgeDotSize, edgeInk);

  // Each pixel picks exactly one flat color, no blending between them.
  vec3 col = u_bg;
  if (spiralDots > 0.5) col = u_spiral;
  else if (edgeDots > 0.5) col = u_edge;

  // Paper grain
  col *= (1.0 - u_noiseGrain * 0.5) + noise * u_noiseGrain;

  col *= smoothstep(0.0, 0.12, r);
  fragColor = vec4(col, 1.0);
}
