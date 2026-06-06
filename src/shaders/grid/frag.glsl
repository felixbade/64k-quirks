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
uniform float u_noiseStrength; // displacement amount in uv units
uniform float u_noiseSize;     // feature size of the largest octave
uniform float u_noiseDecay;    // amplitude gain per octave
uniform float u_noiseZ;        // offset along the noise z (time) axis

out vec4 fragColor;

#define NOISE_OCTAVES 8

// Classic Perlin 3D noise (Stefan Gustavson / Ashima, public domain).
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

float cnoise(vec3 P) {
  vec3 Pi0 = floor(P);
  vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P);
  vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x, gy0.x, gz0.x);
  vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
  vec3 g010 = vec3(gx0.z, gy0.z, gz0.z);
  vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
  vec3 g001 = vec3(gx1.x, gy1.x, gz1.x);
  vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
  vec3 g011 = vec3(gx1.z, gy1.z, gz1.z);
  vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}

// Fractal (fBm) 2D displacement from 3D noise. The two output channels sample
// the field at decorrelated offsets so x/y shifts are independent.
vec2 fbm2(vec3 p, float decay) {
  vec2 sum = vec2(0.0);
  float amp = 1.0;
  for (int i = 0; i < NOISE_OCTAVES; i++) {
    sum.x += amp * cnoise(p);
    sum.y += amp * cnoise(p + vec3(17.3, 9.1, 23.7));
    p *= 2.0;
    amp *= decay;
  }
  return sum;
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;

  // Pan-zoom-rotate the sampling coordinates.
  uv /= u_zoom;
  float c = cos(u_rot), s = sin(u_rot);
  uv = mat2(c, -s, s, c) * uv;
  uv += u_center;

  // Warp the sampling coordinate by animated Perlin noise (third input axis
  // is time). Larger u_noiseSize stretches features; u_noiseDecay sets how
  // fast finer octaves fall off.
  vec3 np = vec3(uv, u_time + u_noiseZ) / sqrt(max(u_noiseSize, 1e-4));
  uv += u_noiseStrength * max(sqrt(u_noiseSize), 1e-4) * fbm2(np, u_noiseDecay);

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
