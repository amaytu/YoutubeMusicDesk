// Menu do botão direito em músicas: por enquanto só adicionar/remover de playlists.
import type { Track } from "./types";

class TrackMenu {
  open = $state(false);
  track = $state<Track | null>(null);
  x = $state(0);
  y = $state(0);

  show(track: Track, x: number, y: number) {
    this.track = track;
    this.x = x;
    this.y = y;
    this.open = true;
  }
  close() {
    this.open = false;
  }
}

export const trackMenu = new TrackMenu();

/** use:songMenu={track} — abre o menu de playlists com o botão direito. */
export function songMenu(node: HTMLElement, track: Track | null | undefined) {
  let current = track;
  const onContext = (e: MouseEvent) => {
    if (!current?.videoId) return;
    e.preventDefault();
    e.stopPropagation();
    trackMenu.show(current, e.clientX, e.clientY);
  };
  node.addEventListener("contextmenu", onContext);
  return {
    update(t: Track | null | undefined) {
      current = t;
    },
    destroy() {
      node.removeEventListener("contextmenu", onContext);
    },
  };
}
