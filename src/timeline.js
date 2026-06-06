export const TIMELINE = {
  bpm: 165,
  cues: [
    {
      beat: 0,
      shader: "kifs",
      params: {
        scale: 1.9,
        size: 2.0,
        offsetX: 1.0,
        offsetY: 0.85,
        offsetZ: 0.6,
        rotX: 0.5,
        rotY: 0.8,
      },
    },
    {
      beat: 8,
      shader: "kifs",
      params: {
        scale: 1.8073,
        size: 1.05,
        offsetX: 3.12,
        offsetY: 0.8367,
        offsetZ: 1.33,
        rotX: 0.722,
        rotY: 0.488,
      },
    },
    {
      beat: 16,
      shader: "kifs",
      params: {
        scale: 1.3282,
        size: 0.97,
        offsetX: 1.86,
        offsetY: 1.43,
        offsetZ: 0.0867,
        rotX: 0.752,
        rotY: 0.656,
      },
    },
    {
      beat: 24,
      shader: "kifs",
      params: {
        scale: 1.8849,
        size: 1.33,
        offsetX: 1.5367,
        offsetY: 0.4067,
        offsetZ: -0.4133,
        rotX: -0.244,
        rotY: 1.046,
      },
    },
    {
      beat: 32,
      shader: "tunnel",
      params: {
        speed: 1.2,
        twist: 0.375,
        rotSpeed: 0.0,
        blueDotSize: 8.0,
        pinkDotSize: 12.0,
        paper: [44, 60, 87.5],
        pink: [330, 100, 63.5],
        blue: [208, 100, 39],
      },
    },
    {
      beat: 40,
      shader: "kifs",
      params: {
        scale: 2.391,
        size: 4.84,
        offsetX: 0.28,
        offsetY: 0.547,
        offsetZ: -0.223,
        rotX: -0.898,
        rotY: 1.916,
      },
    },
  ],
};

export function sampleTimeline(timeline, beat) {
  const cues = timeline.cues;
  if (!cues.length) throw new Error("timeline has no cues");
  let cue = cues[0];
  for (const c of cues) {
    if (c.beat <= beat) cue = c;
    else break;
  }
  return { shaderId: cue.shader, values: { ...cue.params } };
}
