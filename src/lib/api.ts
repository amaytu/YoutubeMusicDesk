// Camada de acesso: dentro do Tauri fala com o Rust; no navegador (npm run dev)
// usa dados de demonstração para permitir trabalhar no visual sem o app.
import type { ArtistItem, ArtistPage, AlbumItem, Collection, Lyrics, PlaylistItem, Shelf, Track, YtmEvent } from "./types";

export const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type Mock = typeof import("./mock");
let mockMod: Promise<Mock> | null = null;
const mock = () => (mockMod ??= import("./mock"));

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

async function call<T>(method: string, args?: Record<string, unknown>): Promise<T> {
  if (!IS_TAURI) return (await mock()).call(method, args) as Promise<T>;
  return invoke<T>("ytm", { method, args });
}

// Cache curto: voltar para uma tela já vista é instantâneo.
const TTL = 5 * 60_000;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

function cached<T>(method: string, args?: Record<string, unknown>, ttl = TTL): Promise<T> {
  const key = method + JSON.stringify(args ?? {});
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as Promise<T>;
  const value = call<T>(method, args).catch((e) => {
    cache.delete(key);
    throw e;
  });
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function clearCache() {
  cache.clear();
}

export const api = {
  auth: () => call<{ signedIn: boolean }>("auth"),
  state: () => call<import("./types").PlayerState>("state"),
  home: () => cached<Shelf[]>("home"),
  search: (query: string) => cached<Shelf[]>("search", { query }),
  librarySongs: () => cached<Track[]>("librarySongs"),
  libraryAlbums: () => cached<AlbumItem[]>("libraryAlbums"),
  libraryArtists: () => cached<ArtistItem[]>("libraryArtists"),
  libraryPlaylists: () => cached<PlaylistItem[]>("libraryPlaylists"),
  collection: (id: string) => cached<Collection>("collection", { id }),
  artist: (id: string) => cached<ArtistPage>("artist", { id }),
  lyrics: (videoId: string) => cached<Lyrics | null>("lyrics", { videoId }, 60 * 60_000),
  queue: () => call<Track[]>("queue"),
};

/** Comandos de reprodução (sem resposta). */
export async function playerCmd(name: string, arg?: unknown) {
  if (!IS_TAURI) return (await mock()).cmd(name, arg);
  return invoke("player_cmd", { name, arg: arg ?? null });
}

export async function onYtm(handler: (ev: YtmEvent) => void) {
  if (!IS_TAURI) return (await mock()).listen(handler);
  const { listen } = await import("@tauri-apps/api/event");
  return listen<YtmEvent>("ytm", (e) => handler(e.payload));
}

export async function showLogin() {
  if (!IS_TAURI) return (await mock()).login();
  return invoke("show_login");
}

export async function signOut() {
  clearCache();
  if (!IS_TAURI) return (await mock()).logout();
  return invoke("sign_out");
}

/** Letra sincronizada (formato LRC) via LRCLIB, buscada pelo Rust. */
export async function syncedLyrics(title: string, artist: string, album: string, duration: number): Promise<string | null> {
  if (!IS_TAURI) return (await mock()).lrc(title);
  return invoke<string | null>("synced_lyrics", { title, artist, album: album || null, duration: duration || null });
}

/** Ilha: informa a área clicável da pílula (px relativos à janela). */
export async function islandHitbox(r: { x: number; y: number; w: number; h: number }) {
  if (IS_TAURI) return invoke("island_hitbox", r);
}

/** Ilha: traz a janela principal de volta. */
export async function showMain() {
  if (IS_TAURI) return invoke("show_main");
}

export const win = {
  async minimize() {
    if (IS_TAURI) (await import("@tauri-apps/api/window")).getCurrentWindow().minimize();
  },
  async toggleMaximize() {
    if (IS_TAURI) (await import("@tauri-apps/api/window")).getCurrentWindow().toggleMaximize();
  },
  async close() {
    if (IS_TAURI) (await import("@tauri-apps/api/window")).getCurrentWindow().close();
  },
  async onResized(fn: (maximized: boolean) => void) {
    if (!IS_TAURI) return;
    const w = (await import("@tauri-apps/api/window")).getCurrentWindow();
    fn(await w.isMaximized());
    return w.onResized(async () => fn(await w.isMaximized()));
  },
};
