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

float map(vec3 p) {
  p = rotY(u_time * 0.7) * rotX(u_time * 0.5) * p;
  return sdBox(p, vec3(0.7));
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

  vec3 ro = vec3(0.0, 0.0, 3.0);
  vec3 rd = normalize(vec3(uv, -1.5));

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
