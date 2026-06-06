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
        costScale: 360,
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
        costScale: 360,
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
        costScale: 360,
      },
    },
    {
      beat: 24,
      shader: "kifs",
      params: {
        scale: 1.8073,
        size: 1.05,
        offsetX: 3.12,
        offsetY: 0.8367,
        offsetZ: 1.33,
        rotX: 0.722,
        rotY: 0.488,
        costScale: 360,
      },
    },
    {
      beat: 32,
      shader: "tunnel",
      params: { speed: 1.2, twist: 0.4 },
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
