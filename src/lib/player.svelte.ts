// Estado global do player (Svelte 5 runes).
// O tempo de reprodução é interpolado localmente: o player oculto só avisa em
// eventos (play, pause, seek, troca de faixa), então não há tráfego por segundo.
import { api, onYtm, playerCmd, showLogin, signOut, clearCache } from "./api";
import { vt } from "./fx.svelte";
import type { Collection, PlayerState, RepeatMode, Track } from "./types";

const EMPTY: PlayerState = {
  videoId: "",
  title: "",
  artist: "",
  album: "",
  artistId: "",
  albumId: "",
  thumb: "",
  duration: 0,
  time: 0,
  playing: false,
  volume: 100,
  muted: false,
  liked: false,
  repeat: "NONE",
  at: 0,
};

export type NowTab = "art" | "queue" | "upnext" | "lyrics";

class Player {
  state = $state<PlayerState>({ ...EMPTY });
  time = $state(0);
  /** null = ainda não sabemos (bridge carregando). */
  signedIn = $state<boolean | null>(null);
  /** Incrementa quando a conta muda; telas usam para recarregar. */
  authVersion = $state(0);
  nowPlaying = $state<null | NowTab>(null);

  #seeking = false;
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    onYtm((ev) => {
      if (ev.kind === "state") this.#apply(ev.data);
      else if (ev.kind === "auth") {
        if (ev.data.changed && this.signedIn !== null) {
          clearCache();
          this.authVersion++;
        }
        this.signedIn = ev.data.signedIn;
      }
    });
    api.auth().then((a) => (this.signedIn ??= a.signedIn)).catch(() => {});
    api.state().then((s) => s && this.#apply(s)).catch(() => {});
    document.addEventListener("visibilitychange", () => this.#syncTimer());
  }

  #apply(s: PlayerState) {
    this.state = s;
    if (!this.#seeking) this.time = s.time;
    this.#syncTimer();
  }

  /** Relógio local só enquanto toca e a janela está visível. */
  #syncTimer() {
    const run = this.state.playing && !document.hidden;
    if (run && !this.#timer) {
      this.#timer = setInterval(() => {
        if (this.#seeking) return;
        const s = this.state;
        this.time = Math.min(s.duration || Infinity, s.time + (Date.now() - s.at) / 1000);
      }, 250);
    } else if (!run && this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  /** Abre/fecha/troca a aba do "Tocando agora" com transição. */
  openNow(tab: null | NowTab) {
    // Ao abrir pela capa/barra, já mostra a fila.
    if (this.nowPlaying === null && tab === "art") tab = "queue";
    const opening = (this.nowPlaying === null) !== (tab === null);
    if (opening) vt(() => (this.nowPlaying = tab));
    else this.nowPlaying = tab;
  }

  get hasTrack() {
    return !!this.state.videoId;
  }

  toggle() {
    this.state = { ...this.state, playing: !this.state.playing, time: this.time, at: Date.now() };
    this.#syncTimer();
    playerCmd("playPause");
  }
  next() {
    playerCmd("next");
  }
  prev() {
    playerCmd("prev");
  }
  /** Durante o arraste só move a barra; o seek acontece ao soltar. */
  scrub(sec: number) {
    this.#seeking = true;
    this.time = sec;
  }
  seek(sec: number) {
    this.#seeking = false;
    this.time = sec;
    this.state = { ...this.state, time: sec, at: Date.now() };
    playerCmd("seek", sec);
  }
  setVolume(v: number) {
    this.state = { ...this.state, volume: v, muted: v === 0 };
    playerCmd("volume", v);
  }
  toggleMute() {
    this.setVolume(this.state.muted || this.state.volume === 0 ? 60 : 0);
  }
  like() {
    this.state = { ...this.state, liked: !this.state.liked };
    playerCmd("like");
  }
  cycleRepeat() {
    const order: RepeatMode[] = ["NONE", "ALL", "ONE"];
    const next = order[(order.indexOf(this.state.repeat) + 1) % order.length];
    this.state = { ...this.state, repeat: next };
    playerCmd("repeat");
  }
  shuffle() {
    playerCmd("shuffle");
  }

  playTrack(t: Track, playlistId?: string) {
    this.state = { ...this.state, title: t.title, thumb: t.thumb ?? this.state.thumb, playing: true };
    playerCmd("playItem", { videoId: t.videoId, playlistId: playlistId ?? t.playlistId });
  }
  playCollection(c: Pick<Collection, "playlistId" | "tracks">, shuffle = false) {
    if (c.playlistId) playerCmd("playItem", { playlistId: c.playlistId, shuffle });
    else if (c.tracks[0]) this.playTrack(shuffle ? c.tracks[Math.floor(Math.random() * c.tracks.length)] : c.tracks[0]);
  }
  playPlaylistId(playlistId: string, shuffle = false) {
    playerCmd("playItem", { playlistId, shuffle });
  }
  playQueueItem(t: Track) {
    this.state = { ...this.state, title: t.title, thumb: t.thumb ?? this.state.thumb, playing: true };
    playerCmd("playQueueItem", { videoId: t.videoId, index: t.index ?? -1 });
  }

  login() {
    showLogin();
  }
  logout() {
    signOut();
  }
}

export const player = new Player();
