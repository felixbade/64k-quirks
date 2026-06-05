#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

out vec4 fragColor;

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
  const float scale = 1.9;
  const vec3 offset = vec3(1.0, 0.85, 0.6);
  const float size = 2.0;
  mat3 rot = rotX(0.5) * rotY(0.8);

  p /= size;

  float s = 1.0;
  for (int i = 0; i < 5; i++) {
    p = abs(p);
    p = rot * p;
    p = p * scale - offset * (scale - 1.0);
    s *= scale;
  }

  return sdBox(p, vec3(1.0)) / s * size;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

// March a ray up to 100 units. Returns true on hit, writing the distance to t.
bool trace(vec3 ro, vec3 rd, out float t) {
  t = 0.0;
  for (int i = 0; i < 96; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.001) return true;
    t += d;
    if (t > 100.0) break;
  }
  return false;
}

// Sky light: white in the top hemisphere, black in the bottom.
float sky(vec3 rd) {
  return step(0.0, rd.y);
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
float light(vec3 ro, vec3 rd, vec3 seed) {
  float t;
  if (!trace(ro, rd, t)) {
    return sky(rd);
  }

  vec3 p = ro + rd * t;
  vec3 n = calcNormal(p);
  vec3 dir = randomHemisphereDir(n, seed);

  float t2;
  if (trace(p + n * 0.01, dir, t2)) {
    return 0.0;
  }
  return sky(dir);
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

  vec3 seed = vec3(gl_FragCoord.xy, u_time);
  float l = light(ro, rd, seed);
  vec3 col = vec3(l);

  col = pow(col, vec3(0.4545));
  fragColor = vec4(col, 1.0);
}
