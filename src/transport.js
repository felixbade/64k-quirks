import { Player } from "../../parameter-flow/src/player.ts";

export function createTransport(bpm, duration = Infinity) {
  const player = new Player({ duration });

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
  };
}
