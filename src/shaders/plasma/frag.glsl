#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_colorA;    // first plasma color
uniform vec3 u_colorB;    // second plasma color
uniform float u_scale;    // spatial frequency
uniform float u_speed;    // time multiplier
uniform float u_warp;     // domain-warp strength
uniform float u_cubeSize;  // glass cube half extent
uniform float u_ior;       // glass index of refraction
uniform float u_dispersion;// per-channel IOR spread
uniform float u_rotSpeed;  // cube rotation speed
uniform float u_reflect;   // Fresnel reflection strength
uniform vec3 u_glassTint;  // subtle absorption tint

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

// Fractal (fBm) 2D vector from 3D noise, sampled at decorrelated offsets.
// `octaves` lets callers trade detail for speed; the loop bound stays a
// compile-time constant so the compiler can still unroll, and we early-out.
vec2 fbm2(vec3 p, float decay, int octaves) {
  vec2 sum = vec2(0.0);
  float amp = 1.0;
  for (int i = 0; i < NOISE_OCTAVES; i++) {
    if (i >= octaves) break;
    sum.x += amp * cnoise(p);
    sum.y += amp * cnoise(p + vec3(17.3, 9.1, 23.7));
    p *= 2.0;
    amp *= decay;
  }
  return sum;
}

// Plasma scalar field. Sine layers use mutually irrational frequency ratios so
// they never re-phase, and a time-advancing Perlin layer plus domain warp break
// any spatial/temporal tiling -> the pattern keeps evolving without repeating.
// `octaves` controls the warp detail; the extra Perlin layer is skipped in the
// cheap regime since it is invisible once a ray is distorted through glass.
float plasma(vec2 p, float t, int octaves) {
  vec2 w = fbm2(vec3(p * 0.6, t * 0.15), 0.55, octaves);
  p += u_warp * w;

  float v = 0.0;
  v += sin(p.x * 1.00 + t * 1.00);
  v += sin(p.y * 1.37 - t * 0.91);
  v += sin((p.x + p.y) * 0.78 + t * 1.13);
  v += sin(length(p + vec2(1.3, -0.7)) * 1.21 - t * 0.67);
  if (octaves >= 4) v += 2.2 * cnoise(vec3(p * 0.5, t * 0.25));
  return v;
}

vec3 plasmaColor(vec2 p, float t, int octaves) {
  float v = plasma(p, t, octaves);
  // Smooth oscillation into [0, 1]; the field itself is unbounded but slow.
  float f = 0.5 + 0.5 * sin(v * 0.7);
  f = smoothstep(0.0, 1.0, f);
  return mix(u_colorA, u_colorB, f);
}

// Full-detail field for the directly-visible fullscreen background.
vec3 background(vec2 p, float t) {
  return plasmaColor(p, t, NOISE_OCTAVES);
}

vec3 env(vec3 ro, vec3 rd, float t) {
  float bgZ = -3.0;
  // Guard rays that point away from the plane (rd.z >= 0) or graze it
  // (rd.z ~ 0); both send the plane hit to infinity and alias the plasma.
  float denom = min(rd.z, -0.15);
  float h = clamp((bgZ - ro.z) / denom, 0.0, 12.0);
  vec2 p = (ro + rd * h).xy * u_scale;
  // Roll spatial frequency down with distance so far samples stop aliasing.
  p /= 1.0 + h * 0.18;
  // Cheap 2-octave field: this is sampled 7x per spectral pass plus the
  // reflection, and the glass distortion + distance rolloff hide the missing
  // detail, so the full 8-octave plasma here was the dominant GPU cost.
  return plasmaColor(p, t, 2);
}

mat3 axisAngle(vec3 axis, float a) {
  axis = normalize(axis);
  float c = cos(a);
  float s = sin(a);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c,
    oc * axis.x * axis.y + axis.z * s,
    oc * axis.z * axis.x - axis.y * s,
    oc * axis.x * axis.y - axis.z * s,
    oc * axis.y * axis.y + c,
    oc * axis.y * axis.z + axis.x * s,
    oc * axis.z * axis.x + axis.y * s,
    oc * axis.y * axis.z - axis.x * s,
    oc * axis.z * axis.z + c
  );
}

bool boxIntersect(vec3 ro, vec3 rd, vec3 b, out float tN, out float tF, out vec3 nN, out vec3 nF) {
  vec3 invRd = vec3(1.0) / rd;
  vec3 t0 = (-b - ro) * invRd;
  vec3 t1 = ( b - ro) * invRd;
  vec3 tn = min(t0, t1);
  vec3 tf = max(t0, t1);

  tN = max(max(tn.x, tn.y), tn.z);
  tF = min(min(tf.x, tf.y), tf.z);
  if (tN > tF || tF < 0.0) return false;

  nN = vec3(0.0);
  if (tn.x > tn.y && tn.x > tn.z) nN.x = -sign(rd.x);
  else if (tn.y > tn.z) nN.y = -sign(rd.y);
  else nN.z = -sign(rd.z);

  nF = vec3(0.0);
  if (tf.x < tf.y && tf.x < tf.z) nF.x = sign(rd.x);
  else if (tf.y < tf.z) nF.y = sign(rd.y);
  else nF.z = sign(rd.z);
  return true;
}

float fresnelSchlick(float cosTheta, float f0) {
  return f0 + (1.0 - f0) * pow(1.0 - clamp(cosTheta, 0.0, 1.0), 5.0);
}

float iorAtWavelength(float nm) {
  float l = nm * 0.001; // micrometers
  float lo = 0.42;
  float hi = 0.68;
  float mid = 0.55;
  float b = u_dispersion / ((1.0 / (lo * lo)) - (1.0 / (hi * hi)));
  float a = u_ior - b / (mid * mid);
  return a + b / (l * l);
}

vec3 spectralWeight(float nm) {
  float r = exp(-0.5 * pow((nm - 610.0) / 55.0, 2.0));
  float g = exp(-0.5 * pow((nm - 545.0) / 45.0, 2.0));
  float b = exp(-0.5 * pow((nm - 460.0) / 38.0, 2.0));
  return vec3(r, g, b);
}

vec3 glassRay(vec3 entryLocal, vec3 rdLocal, vec3 nEntryLocal, mat3 rot, float ior, float t) {
  vec3 insideDir = refract(rdLocal, nEntryLocal, 1.0 / ior);
  if (length(insideDir) < 0.001) {
    vec3 worldPos = rot * entryLocal;
    vec3 worldDir = rot * reflect(rdLocal, nEntryLocal);
    return env(worldPos, worldDir, t);
  }

  float tN;
  float tF;
  vec3 nN;
  vec3 nExitLocal;
  vec3 halfSize = vec3(u_cubeSize);
  vec3 insideRo = entryLocal + insideDir * 0.001;
  if (!boxIntersect(insideRo, insideDir, halfSize, tN, tF, nN, nExitLocal)) {
    vec3 worldPos = rot * entryLocal;
    vec3 worldDir = rot * insideDir;
    return env(worldPos, worldDir, t);
  }
  vec3 exitLocal = insideRo + insideDir * tF;
  vec3 outDir = refract(insideDir, -nExitLocal, ior);
  if (length(outDir) < 0.001) outDir = reflect(insideDir, -nExitLocal);

  vec3 worldPos = rot * exitLocal;
  vec3 worldDir = rot * outDir;
  float travel = max(tF, 0.0);
  return env(worldPos, worldDir, t) * mix(vec3(1.0), u_glassTint, clamp(travel * 0.25, 0.0, 0.6));
}

vec3 spectralGlass(vec3 entryLocal, vec3 rdLocal, vec3 nEntryLocal, mat3 rot, float t) {
  vec3 sum = vec3(0.0);
  vec3 weights = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float nm = mix(430.0, 670.0, float(i) / 6.0);
    vec3 w = spectralWeight(nm);
    sum += glassRay(entryLocal, rdLocal, nEntryLocal, rot, iorAtWavelength(nm), t) * w;
    weights += w;
  }
  return sum / max(weights, vec3(0.001));
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
  float t = u_time * u_speed;
  vec3 col = background(uv * u_scale, t);

  vec3 ro = vec3(0.0, 0.0, 3.2);
  vec3 rd = normalize(vec3(uv, -1.7));

  mat3 rot = axisAngle(vec3(0.45, 1.0, 0.25), u_time * u_rotSpeed);
  mat3 invRot = transpose(rot);
  vec3 roLocal = invRot * ro;
  vec3 rdLocal = invRot * rd;

  float tNear;
  float tFar;
  vec3 nNearLocal;
  vec3 nFarLocal;
  if (boxIntersect(roLocal, rdLocal, vec3(u_cubeSize), tNear, tFar, nNearLocal, nFarLocal)) {
    vec3 entryLocal = roLocal + rdLocal * tNear;
    vec3 nNear = normalize(rot * nNearLocal);
    vec3 entryWorld = rot * entryLocal;

    float f0 = pow((u_ior - 1.0) / (u_ior + 1.0), 2.0);
    float fresnel = clamp(fresnelSchlick(dot(-rd, nNear), f0) * u_reflect, 0.0, 1.0);

    vec3 reflectCol = env(entryWorld, reflect(rd, nNear), t);

    vec3 refractCol = spectralGlass(entryLocal, rdLocal, nNearLocal, rot, t);

    float edge = pow(1.0 - abs(dot(rd, nNear)), 3.0);
    vec3 glassCol = mix(refractCol, reflectCol, fresnel);
    glassCol += edge * 0.18 * u_glassTint;

    col = clamp(glassCol, 0.0, 1.0);
  }
  fragColor = vec4(col, 1.0);
}
