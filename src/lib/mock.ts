// Dados de demonstração (fictícios) para desenvolver a UI no navegador.
// Carregado só quando o app NÃO está rodando dentro do Tauri.
import type { AlbumItem, ArtistItem, ArtistPage, Collection, PlayerState, PlaylistItem, Shelf, Track, YtmEvent } from "./types";

const PALETTES = [
  ["#ff6a88", "#ff99ac", "#6a0572"], ["#2bc4d4", "#1e3c72", "#0b0b2b"], ["#f7971e", "#ffd200", "#7a2e00"],
  ["#8e2de2", "#4a00e0", "#120024"], ["#11998e", "#38ef7d", "#04332f"], ["#fc466b", "#3f5efb", "#1b1037"],
  ["#c94b4b", "#4b134f", "#16050f"], ["#00c6ff", "#0072ff", "#031a3a"], ["#f953c6", "#b91d73", "#2b0a1d"],
  ["#e0c3fc", "#8ec5fc", "#2c3e75"], ["#f4d03f", "#16a085", "#0c3b30"], ["#ee9ca7", "#ffdde1", "#6b3b45"],
];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function cover(seed: string, round = false): string {
  const h = hash(seed);
  const [a, b, c] = PALETTES[h % PALETTES.length];
  const shape = h % 3;
  const initials = seed.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const art =
    shape === 0
      ? `<circle cx="${30 + (h % 40)}" cy="${35 + (h % 30)}" r="${22 + (h % 18)}" fill="${b}" opacity=".85"/>`
      : shape === 1
        ? `<path d="M0 ${70 + (h % 20)} Q50 ${20 + (h % 30)} 100 ${60 + (h % 30)} V100 H0Z" fill="${b}" opacity=".8"/>`
        : `<rect x="${15 + (h % 20)}" y="${15 + (h % 25)}" width="45" height="45" rx="6" transform="rotate(${h % 45} 50 50)" fill="${b}" opacity=".8"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/>${art}${
    round ? `<text x="50" y="62" font-family="Segoe UI,Arial" font-size="30" font-weight="700" fill="#fff" text-anchor="middle" opacity=".9">${initials}</text>` : ""
  }</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

const ARTISTS = ["Neon Valley", "Aurora Lane", "The Paper Kites", "Marea Alta", "Lumen Drift", "Kai Moreno", "Velvet Static", "Saya Ito", "Northbound", "Cora Bay", "Echo Garden", "Tiago Prado"];
const WORDS = ["Midnight", "Golden", "Echoes", "Afterglow", "Paper", "Static", "Ocean", "City", "Lights", "Gravity", "Bloom", "Horizon", "Velvet", "Wildfire", "Silver", "Dreams", "Runaway", "Satellite", "Summer", "Shadows", "Neon", "Electric", "Heartbeat", "Starlight"];

let seed = 7;
const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const title = (n = 2) => Array.from({ length: n }, () => pick(WORDS)).join(" ");
const dur = () => `${2 + Math.floor(rnd() * 3)}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}`;

const artistItems: ArtistItem[] = ARTISTS.map((name, i) => ({
  kind: "artist", id: `UCmock${i}`, title: name, subtitle: `${(1 + rnd() * 9).toFixed(1)} mi de inscritos`, thumb: cover(name, true),
}));

const albums: (AlbumItem & { tracks: Track[] })[] = [];
ARTISTS.forEach((artist, ai) => {
  const n = 2 + (ai % 3);
  for (let k = 0; k < n; k++) {
    const t = title(1 + (k % 2));
    const id = `MPREmock${ai}_${k}`;
    const thumb = cover(t + artist);
    const tracks: Track[] = Array.from({ length: 8 + Math.floor(rnd() * 6) }, (_, j) => ({
      kind: "song", videoId: `v${ai}_${k}_${j}`, title: title(1 + (j % 3)), artists: [{ name: artist, id: `UCmock${ai}` }],
      album: { name: t, id }, duration: dur(), thumb, playlistId: `OLAKmock${ai}_${k}`,
    }));
    albums.push({ kind: "album", id, title: t, subtitle: `${artist} • ${2012 + ((ai + k * 3) % 13)}`, artists: [{ name: artist, id: `UCmock${ai}` }], year: String(2012 + ((ai + k * 3) % 13)), thumb, tracks });
  }
});
const allTracks = albums.flatMap((a) => a.tracks);
const likedIds = new Set(allTracks.slice(0, 60).map((t) => t.videoId));

const MANY = typeof location !== "undefined" && new URLSearchParams(location.search).has("many");
const PL_NAMES = ["Foco total", "Treino", "Chuva lá fora", "Road trip", "Anos 2010", "Descobertas da semana"];
if (MANY) for (let i = 1; i <= 24; i++) PL_NAMES.push(`Mix pessoal ${i}`);
let playlists: (PlaylistItem & { tracks: Track[] })[] = PL_NAMES.map((t, i) => ({
  kind: "playlist", id: `VLPLmock${i}`, title: t, subtitle: `Playlist • ${20 + i * 7} músicas`, thumb: cover(t),
  tracks: Array.from({ length: 20 + i * 3 }, () => pick(allTracks)),
}));

const LOREM =
  "Formado em uma pequena cidade litorânea, o projeto começou como gravações caseiras feitas à noite e cresceu até lotar festivais. As letras falam de estrada, saudade e recomeços, sobre camadas de sintetizadores quentes e guitarras limpas. Em 2019 o álbum de estreia entrou nas listas de melhores do ano e abriu portas para turnês pela América do Sul e Europa.";

function collection(id: string): Collection {
  const a = albums.find((x) => x.id === id);
  if (a)
    return {
      kind: "album", id, title: a.title, subtitle: `Álbum • ${a.year}`, info: `${a.tracks.length} músicas • 38 minutos`,
      description: "", artists: a.artists!, year: a.year, thumb: a.thumb!, playlistId: a.tracks[0].playlistId, tracks: a.tracks,
    };
  const p = playlists.find((x) => x.id === id) ?? playlists[0];
  return {
    kind: "playlist", id: p.id, title: p.title, subtitle: "Playlist • Você", info: `${p.tracks.length} músicas • 1 hora`,
    description: "Uma seleção para acompanhar o seu dia.", artists: [], thumb: p.thumb!, playlistId: p.id.slice(2), tracks: p.tracks, editable: true,
  };
}

function artist(id: string): ArtistPage {
  const i = Number(id.replace("UCmock", "")) || 0;
  const name = ARTISTS[i % ARTISTS.length];
  const own = albums.filter((a) => a.artists?.[0]?.id === `UCmock${i}`);
  return {
    id, name, description: LOREM, thumb: cover(name, true), subscribers: "2,4 mi de inscritos", monthlyListeners: "8,1 mi ouvintes mensais",
    playlistId: own[0]?.tracks[0].playlistId, radioPlaylistId: "RDmock",
    songs: own.flatMap((a) => a.tracks).slice(0, 10), albums: own.slice(0, -1), singles: own.slice(-1), videos: [],
    related: artistItems.filter((a) => a.id !== id).slice(0, 6),
  };
}

const home: Shelf[] = [
  { title: "Escolhas rápidas", items: allTracks.slice(0, 16) },
  { title: "Ouvidos recentemente", items: [...albums.slice(0, 4), artistItems[2], ...playlists.slice(0, 3)] },
  { title: "Mixes para você", items: playlists },
  { title: "Artistas que você curte", items: artistItems },
  { title: "Novos lançamentos", items: albums.slice(10, 22) },
];

// ------------------------------------------------------------- reprodução simulada
const listeners = new Set<(e: YtmEvent) => void>();
let queue: Track[] = allTracks.slice(0, 12);
let qi = 0;
const state: PlayerState = {
  videoId: "", title: "", artist: "", album: "", artistId: "", albumId: "", thumb: "", duration: 0, time: 0,
  playing: false, volume: 70, muted: false, liked: false, repeat: "NONE", at: Date.now(),
};
let signedIn = true;
let chip = 0;

function emit() {
  state.at = Date.now();
  for (const l of listeners) l({ kind: "state", data: { ...state } });
}
let startAt: Record<string, number> = {};
function load(t: Track, play = true) {
  const dur = t.duration!.split(":").reduce((a, p) => a * 60 + Number(p), 0);
  Object.assign(state, {
    videoId: t.videoId, title: t.title, artist: t.artists?.map((a) => a.name).join(", ") ?? "", album: t.album?.name ?? "",
    artistId: t.artists?.[0]?.id ?? "", albumId: t.album?.id ?? "", thumb: t.thumb ?? "",
    duration: dur, time: (startAt[t.videoId] ?? 0) < dur - 1 ? (startAt[t.videoId] ?? 0) : 0, playing: play, liked: false,
  });
  emit();
}
setInterval(() => {
  if (!state.playing) return;
  state.time += 1;
  if (state.time >= state.duration) {
    qi = (qi + 1) % queue.length;
    load(queue[qi]);
  } else state.time = state.time; // tempo é interpolado na UI
}, 1000);
load(queue[0], false);

const wait = <T>(v: T, ms = 220) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms));

export async function call(method: string, args: any = {}): Promise<unknown> {
  switch (method) {
    case "auth": return wait({ signedIn }, 50);
    case "state": return wait({ ...state, at: Date.now() }, 30);
    case "home": return wait(home);
    case "search": {
      const q = String(args.query).toLowerCase();
      const ar = artistItems.filter((a) => a.title.toLowerCase().includes(q));
      const al = albums.filter((a) => a.title.toLowerCase().includes(q) || a.subtitle!.toLowerCase().includes(q));
      const tr = allTracks.filter((t) => t.title.toLowerCase().includes(q) || t.artists![0].name.toLowerCase().includes(q));
      const top = ar[0] ?? al[0] ?? tr[0];
      return wait([
        ...(top ? [{ title: "Melhor resultado", top: true, items: [top] }] : []),
        { title: "Músicas", items: tr.slice(0, 8) },
        { title: "Álbuns", items: al.slice(0, 10) },
        { title: "Artistas", items: ar },
      ].filter((s) => s.items.length));
    }
    case "librarySongs": return wait(signedIn ? allTracks.filter((t) => likedIds.has(t.videoId)) : []);
    case "libraryAlbums": return wait(signedIn ? albums.map(({ tracks, ...a }) => a) : []);
    case "libraryArtists": return wait(signedIn ? artistItems : []);
    case "libraryPlaylists": return wait(signedIn ? playlists.map(({ tracks, ...p }) => p) : []);
    case "collection": return wait(collection(args.id));
    case "artist": return wait(artist(args.id));
    case "lyrics":
      return wait({
        text: "Acendo as luzes da cidade\nE o céu se apaga devagar\nTodo eco da saudade\nVolta pra me encontrar\n\nCorre, corre, horizonte\nLeva o que eu não sei dizer\nSe a noite for ponte\nAtravesso até você\n\n(letra de demonstração)",
        source: "Fonte: demonstração",
      });
    case "timedLyrics": return wait(null, 60);
    case "queue": return wait(queue.map((t, i) => ({ ...t, index: i, selected: i === qi })), 80);
    case "addTargets": return wait(playlists.map((p) => ({ playlistId: p.id.slice(2), title: p.title, contains: p.tracks.some((t) => t.videoId === args.videoId) })), 150);
    case "editPlaylist": {
      const p = playlists.find((x) => x.id.slice(2) === args.playlistId);
      const t = allTracks.find((x) => x.videoId === args.videoId) ?? queue.find((x) => x.videoId === args.videoId);
      if (p && t) p.tracks = args.add ? [...p.tracks, t] : p.tracks.filter((x) => x.videoId !== t.videoId);
      return wait(true, 250);
    }
    case "createPlaylist": {
      const title = String(args.title ?? "").trim();
      if (!title) throw new Error("Dê um nome para a playlist");
      const id = `PLnew${Date.now()}`;
      const tracks = (args.videoIds ?? []).map((v: string) => allTracks.find((t) => t.videoId === v)).filter(Boolean);
      playlists = [{ kind: "playlist", id: "VL" + id, title, subtitle: "Playlist • Você", thumb: cover(title), tracks }, ...playlists];
      return wait({ playlistId: id, title }, 300);
    }
    case "renamePlaylist": {
      const p = playlists.find((x) => x.id.slice(2) === args.playlistId);
      if (p) p.title = String(args.title).trim();
      return wait(true, 200);
    }
    case "deletePlaylist":
      playlists = playlists.filter((x) => x.id.slice(2) !== args.playlistId);
      return wait(true, 250);
    case "rate":
      if (args.like) likedIds.add(args.videoId);
      else likedIds.delete(args.videoId);
      if (state.videoId === args.videoId) { state.liked = !!args.like; setTimeout(emit, 100); }
      return wait(true, 200);
    case "queueChips": return wait(["Tudo", "Conhecidas", "Em alta", "Descobrir"].map((label, index) => ({ index, label, selected: index === chip })), 40);
  }
  throw new Error(`mock: ${method}`);
}

export function cmd(name: string, arg: any) {
  switch (name) {
    case "playPause": state.playing = !state.playing; break;
    case "next": qi = (qi + 1) % queue.length; load(queue[qi]); return;
    case "prev": qi = (qi - 1 + queue.length) % queue.length; load(queue[qi]); return;
    case "seek": state.time = Number(arg); break;
    case "volume": state.volume = Number(arg); state.muted = state.volume === 0; break;
    case "like":
      state.liked = !state.liked;
      if (state.liked) likedIds.add(state.videoId);
      else likedIds.delete(state.videoId);
      break;
    case "repeatOne": state.repeat = arg ? "ONE" : "NONE"; break;
    case "setStartTimes": startAt = arg ?? {}; break;
    case "shuffle": queue = [...queue.slice(0, qi + 1), ...queue.slice(qi + 1).sort(() => rnd() - 0.5)]; break;
    case "selectQueueChip": {
      chip = Number(typeof arg === "object" && arg ? arg.index : arg);
      const rest = [allTracks.slice(12, 30), allTracks.slice(0, 12), allTracks.slice(45, 60), allTracks.slice(30, 45)][chip] ?? allTracks.slice(12, 30);
      queue = [...queue.slice(0, qi + 1), ...rest.filter((t) => t.videoId !== queue[qi].videoId)];
      return;
    }
    case "playQueueItem": qi = Math.max(0, queue.findIndex((t) => t.videoId === arg.videoId)); load(queue[qi]); return;
    case "playItem": {
      const list = albums.find((a) => a.tracks[0].playlistId === arg.playlistId)?.tracks
        ?? playlists.find((p) => p.id.slice(2) === arg.playlistId)?.tracks;
      if (list) queue = arg.shuffle ? [...list].sort(() => rnd() - 0.5) : list;
      else if (arg.videoId) queue = [allTracks.find((t) => t.videoId === arg.videoId)!, ...allTracks.slice(20, 30)];
      qi = Math.max(0, queue.findIndex((t) => t.videoId === arg.videoId));
      load(queue[qi]);
      return;
    }
  }
  emit();
}

export async function listen(fn: (e: YtmEvent) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function login() {
  signedIn = true;
  for (const l of listeners) l({ kind: "auth", data: { signedIn, changed: true } });
}
export function logout() {
  signedIn = false;
  for (const l of listeners) l({ kind: "auth", data: { signedIn, changed: true } });
}

/** LRC de demonstração: uma linha a cada 4 s. */
export async function lrc(_title: string): Promise<string | null> {
  const lines = ["I remember every single word we said that night when the city lights were all we had", "And the sky slowly fades", "Every echo of longing", "Comes back to find me", "", "Run, run, horizon", "Take what I can't say", "If the night is a bridge", "I'll cross over to you"];
  const out: string[] = [];
  for (let i = 0; i < 40; i++) {
    const t = 2 + i * 4;
    out.push(`[${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}.00]${lines[i % lines.length]}`);
  }
  return wait(out.join("\n"), 120);
}

/** Tradução de demonstração. */
export async function translate(lines: string[]) {
  const dict: Record<string, string> = {
    "I turn on the city lights": "Acendo as luzes da cidade",
    "And the sky slowly fades": "E o céu se apaga devagar",
    "Every echo of longing": "Todo eco da saudade",
    "Comes back to find me": "Volta pra me encontrar",
    "Run, run, horizon": "Corre, corre, horizonte",
    "Take what I can't say": "Leva o que eu não sei dizer",
    "If the night is a bridge": "Se a noite for ponte",
    "I'll cross over to you": "Atravesso até você",
  };
  return wait({ lines: lines.map((l) => dict[l] ?? l), source: "en", provider: "demo" }, 300);
}

/** Cor de demonstração: primeira cor do degradê da capa gerada. */
export async function coverColor(url: string): Promise<[number, number, number] | null> {
  const m = decodeURIComponent(url).match(/stop-color="#([0-9a-f]{6})"/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
