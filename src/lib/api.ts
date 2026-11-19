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

/** Alguma chamada falhou por falta de internet (a UI recarrega ao voltar). */
export const net = { failed: false };

async function call<T>(method: string, args?: Record<string, unknown>): Promise<T> {
  if (!IS_TAURI) return (await mock()).call(method, args) as Promise<T>;
  try {
    return await invoke<T>("ytm", { method, args });
  } catch (e) {
    if (/conex|internet|não respondeu/i.test(String(e))) net.failed = true;
    throw e;
  }
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

/** Esquece uma resposta em cache (ex.: playlist que acabou de mudar). */
export function invalidate(method: string, args?: Record<string, unknown>) {
  cache.delete(method + JSON.stringify(args ?? {}));
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
  timedLyrics: (videoId: string) =>
    cached<{ lines: { t: number; text: string }[]; source: string } | null>("timedLyrics", { videoId }, 60 * 60_000),
  queue: () => call<Track[]>("queue"),
  addTargets: (videoId: string) =>
    call<{ playlistId: string; title: string; contains: boolean }[]>("addTargets", { videoId }),
  editPlaylist: (playlistId: string, videoId: string, add: boolean) =>
    call<boolean>("editPlaylist", { playlistId, videoId, add }),
  queueChips: () => call<{ index: number; label: string; selected: boolean }[]>("queueChips"),
  createPlaylist: (title: string, videoIds: string[] = [], privacy: "PRIVATE" | "UNLISTED" | "PUBLIC" = "PRIVATE") =>
    call<{ playlistId: string; title: string }>("createPlaylist", { title, videoIds, privacy }),
  renamePlaylist: (playlistId: string, title: string) => call<boolean>("renamePlaylist", { playlistId, title }),
  deletePlaylist: (playlistId: string) => call<boolean>("deletePlaylist", { playlistId }),
  rate: (videoId: string, like: boolean) => call<boolean>("rate", { videoId, like }),
};

// ------------------------------------------------------------------ configurações

export interface Prefs {
  autostart: boolean;
  closeToTray: boolean;
  economy: boolean;
  mediaKeys: boolean;
  island: boolean;
  deepl: boolean;
  version: string;
}

let mockPrefs: Prefs = { autostart: false, closeToTray: true, economy: true, mediaKeys: true, island: true, deepl: false, version: "demo" };

export async function getPrefs(): Promise<Prefs> {
  if (!IS_TAURI) return { ...mockPrefs };
  return invoke<Prefs>("get_prefs");
}

export async function setPref(key: string, value: unknown): Promise<Prefs> {
  if (!IS_TAURI) {
    if (key === "deeplKey") mockPrefs = { ...mockPrefs, deepl: !!String(value ?? "").trim() };
    else mockPrefs = { ...mockPrefs, [key]: value };
    return { ...mockPrefs };
  }
  return invoke<Prefs>("set_pref", { key, value });
}

// ------------------------------------------------------------------ atualizações

export interface Update {
  version: string;
  notes: string;
  url: string;
  size: number;
}

export async function checkUpdate(): Promise<Update | null> {
  if (!IS_TAURI) {
    // demo: ?update na URL simula uma versão nova
    return new URLSearchParams(location.search).has("update")
      ? { version: "1.0.1", notes: "Correções e melhorias.", url: "", size: 2_400_000 }
      : null;
  }
  return invoke<Update | null>("check_update");
}

/** Baixa e instala (o app fecha e reabre). onProgress recebe 0..1. */
export async function installUpdate(u: Update, onProgress: (p: number) => void): Promise<void> {
  if (!IS_TAURI) {
    for (let p = 0; p <= 1; p += 0.1) {
      onProgress(p);
      await new Promise((r) => setTimeout(r, 120));
    }
    throw new Error("Demonstração: nada para instalar");
  }
  const { listen } = await import("@tauri-apps/api/event");
  const off = await listen<number>("update-progress", (e) => onProgress(e.payload));
  try {
    await invoke("install_update", { url: u.url });
  } finally {
    off();
  }
}

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

export interface Translation {
  lines: string[];
  source: string;
  provider: string;
}

/** Traduz linhas da letra (Google Tradutor por padrão; DeepL se houver chave). */
export async function translateLines(lines: string[], target = "pt"): Promise<Translation> {
  if (!IS_TAURI) return (await mock()).translate(lines);
  return invoke<Translation>("translate_lines", { lines, target });
}

/** Cor dominante da capa [r, g, b] (calculada no Rust). */
export async function coverColor(url: string): Promise<[number, number, number] | null> {
  if (!IS_TAURI) return (await mock()).coverColor(url);
  return invoke<[number, number, number] | null>("cover_color", { url });
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
