// Estado global do player (Svelte 5 runes).
// O tempo de reprodução é interpolado localmente: o player oculto só avisa em
// eventos (play, pause, seek, troca de faixa), então não há tráfego por segundo.
import { api, net, onYtm, playerCmd, showLogin, signOut, clearCache } from "./api";
import { vt } from "./fx.svelte";
import { likes } from "./playlists.svelte";
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
  /** Aleatório ligado (o YT Music não informa; controlado aqui). */
  shuffleOn = $state(false);
  /** Incrementa quando a fila muda por ação nossa (aleatório, filtros). */
  queueVersion = $state(0);

  #seeking = false;
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    onYtm((ev) => {
      if (ev.kind === "state") this.#apply(ev.data);
      else if (ev.kind === "auth") {
        if (ev.data.changed && this.signedIn !== null) {
          clearCache();
          likes.reset();
          this.authVersion++;
        }
        this.signedIn = ev.data.signedIn;
      }
    });
    api.auth().then((a) => (this.signedIn ??= a.signedIn)).catch(() => {});
    api.state().then((s) => s && this.#apply(s)).catch(() => {});
    document.addEventListener("visibilitychange", () => this.#syncTimer());
    // Internet voltou depois de uma falha: recarrega as telas sozinho.
    window.addEventListener("online", () => {
      if (!net.failed) return;
      net.failed = false;
      setTimeout(() => this.authVersion++, 1500);
    });
  }

  #lastUpdate = Date.now();

  #apply(s: PlayerState) {
    this.#lastUpdate = Date.now();
    // Faixa nova: descarta qualquer arraste em andamento da faixa anterior.
    if (s.videoId !== this.state.videoId) this.#seeking = false;
    this.state = s;
    if (!this.#seeking) this.time = s.time;
    this.#syncTimer();
  }

  /** Relógio local só enquanto toca e a janela está visível. */
  #syncTimer() {
    const run = this.state.playing && !document.hidden;
    if (run && !this.#timer) {
      this.#timer = setInterval(() => {
        // Vigia: tocando e sem notícias do player há 12 s -> pede o estado real.
        if (Date.now() - this.#lastUpdate > 12000) {
          this.#lastUpdate = Date.now();
          api.state().then((st) => st && this.#apply(st)).catch(() => {});
        }
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
    // Decide pelo último pedido (a transição anterior pode não ter aplicado ainda):
    // abrir e apertar Esc logo em seguida não pode deixar a tela aberta.
    const cur = this.#nowTarget;
    // Ao abrir pela capa/barra, já mostra a fila.
    if (cur === null && tab === "art") tab = "queue";
    this.#nowTarget = tab;
    const opening = (cur === null) !== (tab === null);
    if (opening) vt(() => (this.nowPlaying = this.#nowTarget));
    else this.nowPlaying = tab;
  }
  #nowTarget: null | NowTab = null;

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
    if (this.state.videoId) likes.set(this.state.videoId, this.state.liked);
    playerCmd("like");
  }
  /** Alterna entre "em sequência" e "repetir esta música". */
  cycleRepeat() {
    const next: RepeatMode = this.state.repeat === "ONE" ? "NONE" : "ONE";
    this.state = { ...this.state, repeat: next };
    playerCmd("repeatOne", next === "ONE");
  }
  /** Liga: embaralha a fila. Desliga: a fila segue na ordem atual. */
  shuffle() {
    this.shuffleOn = !this.shuffleOn;
    if (this.shuffleOn) {
      playerCmd("shuffle");
      setTimeout(() => this.queueVersion++, 900);
    }
  }

  playTrack(t: Track, playlistId?: string) {
    this.shuffleOn = false;
    this.state = { ...this.state, title: t.title, thumb: t.thumb ?? this.state.thumb, playing: true };
    playerCmd("playItem", { videoId: t.videoId, playlistId: playlistId ?? t.playlistId });
  }
  playCollection(c: Pick<Collection, "playlistId" | "tracks">, shuffle = false) {
    this.shuffleOn = shuffle;
    if (c.playlistId) playerCmd("playItem", { playlistId: c.playlistId, shuffle });
    else if (c.tracks[0]) this.playTrack(shuffle ? c.tracks[Math.floor(Math.random() * c.tracks.length)] : c.tracks[0]);
  }
  playPlaylistId(playlistId: string, shuffle = false) {
    this.shuffleOn = shuffle;
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
