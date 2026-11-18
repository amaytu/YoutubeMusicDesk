import { api } from "./api";
import { morphFrom } from "./fx.svelte";
import { player } from "./player.svelte";
import { router } from "./router.svelte";
import type { Item } from "./types";

/**
 * Abre o item (álbum/playlist/artista) ou toca (música).
 * `coverEl`: capa clicada, que "voa" até o cabeçalho da próxima tela.
 */
export function openItem(item: Item, coverEl?: Element | null) {
  const hint = { thumb: item.thumb, title: item.title };
  switch (item.kind) {
    case "song":
      player.playTrack(item);
      return;
    case "artist":
      morphFrom(coverEl);
      router.go({ name: "artist", id: item.id, ...hint });
      return;
    case "album":
    case "playlist":
      morphFrom(coverEl);
      router.go({ name: "collection", id: item.id, ...hint });
      return;
    default:
      if (item.id?.startsWith("UC")) router.go({ name: "artist", id: item.id, ...hint });
      else if (item.id) router.go({ name: "collection", id: item.id, ...hint });
  }
}

/** Pré-carrega ao passar o mouse: a página abre já com os dados. */
export function prefetch(item: Item) {
  if (item.kind === "album" || item.kind === "playlist") api.collection(item.id).catch(() => {});
  else if (item.kind === "artist") api.artist(item.id).catch(() => {});
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
