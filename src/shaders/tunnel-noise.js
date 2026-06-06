const DEFAULT_SIZE = 512;
const DEFAULT_OCTAVES = 5;
const DEFAULT_PERIOD = 64;
const SEED = 0x5eed1234;

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hash2(x, y) {
  let h = SEED ^ Math.imul(x + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(y + 0xc2b2ae35, 0x27d4eb2d);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

function gradient(ix, iy, period, x, y) {
  const gx = ((ix % period) + period) % period;
  const gy = ((iy % period) + period) % period;
  const angle = (hash2(gx, gy) / 0xffffffff) * Math.PI * 2;
  return Math.cos(angle) * x + Math.sin(angle) * y;
}

function perlin2(x, y, period) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xf = x - x0;
  const yf = y - y0;
  const u = fade(xf);
  const v = fade(yf);

  const n00 = gradient(x0, y0, period, xf, yf);
  const n10 = gradient(x0 + 1, y0, period, xf - 1, yf);
  const n01 = gradient(x0, y0 + 1, period, xf, yf - 1);
  const n11 = gradient(x0 + 1, y0 + 1, period, xf - 1, yf - 1);

  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
}

export function generateNoiseData({ size = DEFAULT_SIZE, octaves = DEFAULT_OCTAVES } = {}) {
  const data = new Uint8Array(size * size);
  const period = DEFAULT_PERIOD;
  const amplitudeSum = 2 - 1 / 2 ** (octaves - 1);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let value = 0;
      let amplitude = 1;
      let frequency = 1;

      for (let octave = 0; octave < octaves; octave += 1) {
        value += amplitude * perlin2((x / size) * period * frequency, (y / size) * period * frequency, period * frequency);
        amplitude *= 0.5;
        frequency *= 2;
      }

      const normalized = Math.max(0, Math.min(1, value / amplitudeSum + 0.5));
      data[y * size + x] = Math.round(normalized * 255);
    }
  }

  return { data, size };
}
