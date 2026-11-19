// Adicionar/remover músicas das playlists do usuário.
// A lista de destinos vem do próprio YT Music ("Salvar na playlist") e é
// ordenada pelas playlists em que o usuário adicionou algo mais recentemente.
import { api, invalidate } from "./api";
import type { Track } from "./types";

export interface Target {
  playlistId: string;
  title: string;
  /** A música já está nesta playlist. */
  contains: boolean;
  thumb?: string;
}

const MRU_KEY = "ymd.playlists.mru";
const readMru = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(MRU_KEY) ?? "{}");
  } catch {
    return {};
  }
};

class Playlists {
  mru = $state<Record<string, number>>(readMru());
  /** playlistId -> momento da última alteração (telas abertas recarregam). */
  edits = $state<Record<string, number>>({});
  toast = $state<{ id: number; text: string; thumb?: string; error?: boolean } | null>(null);
  #toastTimer: ReturnType<typeof setTimeout> | undefined;

  /** Playlists editáveis, mais recentes primeiro, com capa e "já está". */
  async targets(videoId: string): Promise<Target[]> {
    const [opts, lib] = await Promise.all([api.addTargets(videoId), api.libraryPlaylists().catch(() => [])]);
    const thumbs = new Map(lib.map((p) => [p.id.replace(/^VL/, ""), p.thumb]));
    const order = new Map(opts.map((o, i) => [o.playlistId, i]));
    return opts
      .map((o) => ({ ...o, thumb: thumbs.get(o.playlistId) }))
      .sort(
        (a, b) =>
          (this.mru[b.playlistId] ?? 0) - (this.mru[a.playlistId] ?? 0) ||
          order.get(a.playlistId)! - order.get(b.playlistId)!,
      );
  }

  async add(track: Track, t: Target) {
    if (t.contains) return this.notify(`Já está em “${t.title}”`, t.thumb);
    try {
      await api.editPlaylist(t.playlistId, track.videoId, true);
      this.#touch(t.playlistId);
      this.#changed(t.playlistId);
      this.notify(`Adicionada a “${t.title}”`, t.thumb);
      return true;
    } catch (e) {
      this.notify(`Não foi possível adicionar a “${t.title}”`, undefined, true);
      return false;
    }
  }

  async remove(track: Track, t: Target) {
    try {
      await api.editPlaylist(t.playlistId, track.videoId, false);
      this.#changed(t.playlistId);
      this.notify(`Removida de “${t.title}”`, t.thumb);
      return true;
    } catch {
      this.notify(`Não foi possível remover de “${t.title}”`, undefined, true);
      return false;
    }
  }

  /** Cria uma playlist (opcionalmente já com uma música). */
  async create(title: string, track?: Track): Promise<Target | null> {
    try {
      const r = await api.createPlaylist(title, track ? [track.videoId] : []);
      this.#touch(r.playlistId);
      this.#libraryChanged();
      this.notify(track ? `Playlist “${r.title}” criada com a música` : `Playlist “${r.title}” criada`, track?.thumb);
      return { playlistId: r.playlistId, title: r.title, contains: !!track };
    } catch (e) {
      this.notify(`Não foi possível criar a playlist: ${e}`, undefined, true);
      return null;
    }
  }

  async rename(playlistId: string, title: string) {
    try {
      await api.renamePlaylist(playlistId, title);
      this.#changed(playlistId);
      this.#libraryChanged();
      this.notify(`Renomeada para “${title.trim()}”`);
      return true;
    } catch (e) {
      this.notify(`Não foi possível renomear: ${e}`, undefined, true);
      return false;
    }
  }

  async destroy(playlistId: string, title: string) {
    try {
      await api.deletePlaylist(playlistId);
      const { [playlistId]: _, ...rest } = this.mru;
      this.mru = rest;
      localStorage.setItem(MRU_KEY, JSON.stringify(rest));
      this.#libraryChanged();
      this.notify(`Playlist “${title}” excluída`);
      return true;
    } catch (e) {
      this.notify(`Não foi possível excluir: ${e}`, undefined, true);
      return false;
    }
  }

  /** Lista de playlists da biblioteca mudou (nova, renomeada, excluída). */
  libraryVersion = $state(0);
  #libraryChanged() {
    invalidate("libraryPlaylists");
    this.libraryVersion++;
  }

  #changed(playlistId: string) {
    invalidate("collection", { id: "VL" + playlistId });
    this.edits = { ...this.edits, [playlistId]: Date.now() };
  }

  #touch(playlistId: string) {
    const next = { ...this.mru, [playlistId]: Date.now() };
    const keys = Object.keys(next);
    if (keys.length > 200) delete next[keys.sort((a, b) => next[a] - next[b])[0]];
    this.mru = next;
    localStorage.setItem(MRU_KEY, JSON.stringify(next));
  }

  notify(text: string, thumb?: string, error = false) {
    clearTimeout(this.#toastTimer);
    this.toast = { id: Date.now(), text, thumb, error };
    this.#toastTimer = setTimeout(() => (this.toast = null), 2600);
  }
}

export const playlists = new Playlists();

// ------------------------------------------------------------------ curtidas

/** Músicas curtidas: base = biblioteca "Músicas"; ajustes locais por cima. */
class Likes {
  #base = $state<Set<string> | null>(null);
  #over = $state<Record<string, boolean>>({});
  #loading = false;

  /** true/false, ou null enquanto não sabemos. */
  is(videoId: string): boolean | null {
    if (videoId in this.#over) return this.#over[videoId];
    if (!this.#base) {
      this.load();
      return null;
    }
    return this.#base.has(videoId);
  }

  load() {
    if (this.#loading || this.#base) return;
    this.#loading = true;
    api
      .librarySongs()
      .then((list) => (this.#base = new Set(list.map((t) => t.videoId))))
      .catch(() => {})
      .finally(() => (this.#loading = false));
  }

  /** Esquece o que sabemos (ex.: troca de conta). */
  reset() {
    this.#base = null;
    this.#over = {};
  }

  /** Marca sem chamar a API (ex.: coração da barra do player). */
  set(videoId: string, on: boolean) {
    this.#over = { ...this.#over, [videoId]: on };
    invalidate("librarySongs");
  }

  async toggle(track: Track) {
    const on = !(this.is(track.videoId) ?? false);
    this.set(track.videoId, on);
    try {
      await api.rate(track.videoId, on);
      playlists.notify(on ? "Adicionada às músicas curtidas" : "Removida das músicas curtidas", track.thumb);
    } catch {
      this.set(track.videoId, !on);
      playlists.notify("Não foi possível alterar a curtida", undefined, true);
    }
  }
}

export const likes = new Likes();
