import { TimelinePlayer } from "../../parameter-flow/src/timelinePlayer.ts";

export function createTransport(bpm, duration = 60) {
  const player = new TimelinePlayer({ duration, bpm });

  return {
    play: () => player.play(),
    pause: () => player.pause(),
    seek: (t) => player.seek(t),
    get currentTime() {
      return player.currentTime;
    },
    get paused() {
      return player.paused;
    },
    beat: () => (player.currentTime * bpm) / 60,
    player,
    element: player.element,
  };
}
