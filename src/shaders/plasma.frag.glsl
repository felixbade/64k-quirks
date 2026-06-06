#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform int u_debug;       // 0 = normal, 1 = cost heatmap
uniform float u_costScale; // steps mapped to full heat at this value
uniform float u_skyFlip;   // +1 normal, -1 flips sky/ground hemispheres
uniform float u_kifsScale;  // KIFS fold scale per iteration
uniform vec3 u_kifsOffset;  // KIFS fold offset
uniform float u_kifsSize;   // KIFS overall size
uniform vec2 u_kifsRot;     // KIFS fold rotation (rotX angle, rotY angle)

out vec4 fragColor;

const int RAYS_PER_PIXEL = 20;
const int STEPS_PER_RAY = 48;
const int STEPS_PER_RAY_BOUNCE = 24;
const int BOUNCES = 3;
const float SKYBOX_DIST = 5.0;
const float SURF_DIST = 0.001;
const float BRIGHTNESS = 2.0;
const float BOOST_CONTRAST = 2.0;
const vec3 SKY_COLOR = vec3(1.0, 0.85, 0.6);     // hdr, yellow/orange
const vec3 GROUND_COLOR = vec3(0.0, 0.05, 0.1); // hdr, blue/teal

// Box signed distance function.
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

// Kaleidoscopic IFS: fold + rotate + scale, 5 iterations.
// Parameters are eyeballed for an architectural / cathedral look.
float map(vec3 p) {
  float scale = u_kifsScale;
  vec3 offset = u_kifsOffset;
  float size = u_kifsSize;
  mat3 rot = rotX(u_kifsRot.x) * rotY(u_kifsRot.y);

  p /= size;

  float s = 1.0;
  for (int i = 0; i < 3; i++) {
    p = abs(p);
    p = rot * p;
    p = p * scale - offset * (scale - 1.0);
    s *= scale;
  }

  return sdBox(p, vec3(1.0)) / s * size;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(SURF_DIST, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

// March a ray up to SKYBOX_DIST units. Returns true on hit, writing the distance to t.
// steps reports how many map() evaluations the march consumed.
// escaped is set when the ray exited past SKYBOX_DIST; a false miss means the
// step budget ran out while still inside the scene.
bool trace(vec3 ro, vec3 rd, out float t, out int steps, out bool escaped, int maxSteps) {
  t = 0.0;
  escaped = false;
  for (int i = 0; i < maxSteps; i++) {
    steps = i + 1;
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < SURF_DIST) return true;
    t += d;
    if (t > SKYBOX_DIST) { escaped = true; break; }
  }
  return false;
}

// Sky light: white in the top hemisphere, black in the bottom.
vec3 sky(vec3 rd) {
  return mix(GROUND_COLOR, SKY_COLOR, step(0.0, rd.y * u_skyFlip)) * BRIGHTNESS;
}

// Two pseudo-random floats in [0, 1) from a seed (Dave Hoskins hash23).
vec2 hash23(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Uniform random direction within the hemisphere around normal n.
vec3 randomHemisphereDir(vec3 n, vec3 seed) {
  vec2 r = hash23(seed);
  float z = r.x * 2.0 - 1.0;
  float a = r.y * 6.2831853;
  float s = sqrt(1.0 - z * z);
  vec3 dir = vec3(s * cos(a), s * sin(a), z);
  if (dot(dir, n) < 0.0) dir = -dir;
  return dir;
}

// Light value for a ray. Misses see the sky. Hits bounce once in a random
// hemisphere direction: black if it hits the object again, sky color if it escapes.
// cost accumulates the total march steps spent on this ray.
vec3 light(vec3 ro, vec3 rd, vec3 seed, inout int cost) {
  float t;
  int steps;
  bool escaped;
  bool hit = trace(ro, rd, t, steps, escaped, STEPS_PER_RAY);
  cost += steps;
  if (!hit && escaped) {
    return sky(rd);
  }
  // Either a real surface hit or the step budget ran out near geometry; in both
  // cases reflect the ray rather than letting it fall through to the sky.

  vec3 p = ro + rd * t;
  vec3 incoming = rd;
  for (int b = 0; b < BOUNCES; b++) {
    vec3 n = calcNormal(p);
    vec3 bseed = seed + float(b) * 1.618;

    // Fresnel-Schlick reflectance (dielectric F0) for the current view angle.
    float cosTheta = clamp(dot(-incoming, n), 0.0, 1.0);
    float fresnel = 0.2 + 0.8 * pow(1.0 - cosTheta, 5.0);

    // Fork: a fresnel-weighted fraction of rays mirror-reflect, the rest diffuse.
    vec3 dir;
    if (hash23(bseed * 1.37 + 7.0).x < fresnel) {
      dir = reflect(incoming, n);
    } else {
      dir = randomHemisphereDir(n, bseed);
    }

    float tb;
    int stepsb;
    bool escapedb;
    bool hitb = trace(p + n * 0.01, dir, tb, stepsb, escapedb, STEPS_PER_RAY_BOUNCE);
    cost += stepsb;

    // A clean escape reaches the sky and ends the path.
    if (escapedb) {
      return sky(dir);
    }
    // Out of bounce budget, or the step budget ran out: fall back to ground.
    if (b == BOUNCES - 1 || !hitb) {
      return GROUND_COLOR * BRIGHTNESS;
    }
    // Real surface hit with bounces left: continue reflecting from here.
    p = p + dir * tb;
    incoming = dir;
  }
  return GROUND_COLOR * BRIGHTNESS;
}

// Cheap black -> red -> yellow -> white heat ramp for cost visualization.
vec3 heat(float x) {
  x = clamp(x, 0.0, 1.0);
  return clamp(vec3(x * 3.0, x * 3.0 - 1.0, x * 3.0 - 2.0), 0.0, 1.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;

  // Orbit camera around the fractal (centered at origin).
  vec3 target = vec3(0.0);
  float a = u_time * 0.3;
  vec3 ro = target + vec3(sin(a), 0.25, cos(a)) * 3.2;
  vec3 fwd = normalize(target - ro);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, right);
  vec3 rd = normalize(uv.x * right + uv.y * up + 1.5 * fwd);

  vec3 l = vec3(0.0);
  int cost = 0;
  for (int i = 0; i < RAYS_PER_PIXEL; i++) {
    vec3 seed = vec3(gl_FragCoord.xy, u_time + float(i) * 1.618);
    l += light(ro, rd, seed, cost);
  }
  l /= float(RAYS_PER_PIXEL);

  if (u_debug == 1) {
    fragColor = vec4(heat(float(cost) / u_costScale), 1.0);
    return;
  }

  vec3 col = l;

  col = pow(col, vec3(exp(BOOST_CONTRAST)));
  col = col / (1.0 + col); // Reinhard tone mapping
  fragColor = vec4(col, 1.0);
}
