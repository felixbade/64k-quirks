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

  float t = 0.0;
  bool hit = false;
  for (int i = 0; i < 96; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.001) { hit = true; break; }
    t += d;
    if (t > 20.0) break;
  }

  vec3 col = vec3(0.05, 0.06, 0.08);
  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 lightDir = normalize(vec3(0.6, 0.8, 0.4));
    float diff = max(dot(n, lightDir), 0.0);
    float amb = 0.2;
    vec3 base = n * 0.5 + 0.5;
    col = base * (amb + diff);
  }

  col = pow(col, vec3(0.4545));
  fragColor = vec4(col, 1.0);
}
