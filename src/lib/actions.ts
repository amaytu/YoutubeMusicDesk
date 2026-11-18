import { api } from "./api";
import { player } from "./player.svelte";
import { router } from "./router.svelte";
import type { Item } from "./types";

/** Abre o item (álbum/playlist/artista) ou toca (música). */
export function openItem(item: Item) {
  switch (item.kind) {
    case "song":
      player.playTrack(item);
      break;
    case "artist":
      router.go({ name: "artist", id: item.id });
      break;
    case "album":
    case "playlist":
      router.go({ name: "collection", id: item.id });
      break;
    default:
      if (item.id?.startsWith("UC")) router.go({ name: "artist", id: item.id });
      else if (item.id) router.go({ name: "collection", id: item.id });
  }
}

/** Botão de play no card: toca direto sem abrir. */
export async function playItem(item: Item) {
  if (item.kind === "song") return player.playTrack(item);
  if (item.kind === "album" || item.kind === "playlist") {
    const c = await api.collection(item.id);
    return player.playCollection(c);
  }
  if (item.kind === "artist") {
    const a = await api.artist(item.id);
    if (a.playlistId) player.playPlaylistId(a.playlistId);
    else if (a.songs[0]) player.playTrack(a.songs[0]);
  }
}
