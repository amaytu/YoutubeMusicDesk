// Letras com tempo: LRCLIB (sincronizada) ou, se não houver, a letra do YouTube
// Music distribuída ao longo da música (aproximada).
import { api, syncedLyrics, translateLines, type Translation } from "./api";
import type { PlayerState } from "./types";

export interface Line {
  t: number;
  text: string;
}
export interface LyricSet {
  lines: Line[];
  synced: boolean;
}

const cache = new Map<string, Promise<LyricSet | null>>();

/** "[01:02.34]texto" -> linhas ordenadas por tempo. Aceita vários tempos por linha. */
export function parseLrc(lrc: string): Line[] {
  const out: Line[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
    if (!stamps.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    for (const m of stamps) out.push({ t: Number(m[1]) * 60 + Number(m[2].replace(":", ".")), text: text || "♪" });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Letra sem tempo: espalha as linhas entre 6% e 94% da duração. */
function spread(text: string, duration: number): Line[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length || duration <= 0) return [];
  const start = duration * 0.06;
  const step = (duration * 0.88) / lines.length;
  return lines.map((text, i) => ({ t: start + i * step, text }));
}

export function loadLyrics(s: PlayerState): Promise<LyricSet | null> {
  // Sem duração ainda (metadados carregando) não dá para espalhar a letra: chave separada.
  const key = s.videoId + (s.duration > 0 ? "" : ":sem-duracao");
  if (!s.videoId) return Promise.resolve(null);
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      try {
        const lrc = await syncedLyrics(s.title, s.artist, s.album, s.duration);
        const lines = lrc ? parseLrc(lrc) : [];
        if (lines.length) return { lines, synced: true };
      } catch {}
      try {
        const l = await api.lyrics(s.videoId);
        const lines = l?.text ? spread(l.text, s.duration) : [];
        if (lines.length) return { lines, synced: false };
      } catch {}
      return null;
    })();
    cache.set(key, p);
    if (cache.size > 50) cache.delete(cache.keys().next().value!);
  }
  return p;
}

/** Índice da linha atual (busca binária). -1 = antes da primeira. */
export function lineAt(lines: Line[], time: number): number {
  let lo = 0,
    hi = lines.length - 1,
    ans = -1;
  const t = time + 0.25; // pequena antecipação: a linha aparece junto com a voz
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

// ------------------------------------------------------------------ tradução

const trCache = new Map<string, Promise<Translation | null>>();

/** Tradução alinhada às linhas da letra (cache por faixa). */
export function translateSet(videoId: string, set: LyricSet, target = "pt"): Promise<Translation | null> {
  const key = `${videoId}:${set.synced ? "s" : "a"}:${target}`;
  let p = trCache.get(key);
  if (!p) {
    p = translateLines(
      set.lines.map((l) => l.text),
      target,
    ).catch(() => {
      trCache.delete(key); // permite tentar de novo
      return null;
    });
    trCache.set(key, p);
    if (trCache.size > 50) trCache.delete(trCache.keys().next().value!);
  }
  return p;
}

/** A letra já está no idioma de destino? (ex.: "pt", "pt-BR") */
export const sameLanguage = (t: Translation | null | undefined, target = "pt") =>
  !!t?.source && t.source.toLowerCase().split(/[-_]/)[0] === target;

// Preferência "traduzir": salva no localStorage e sincronizada entre a janela
// principal e a ilha (mesma origem -> evento "storage").
const KEY = "ymd.lyrics.translate";
class LyricsPrefs {
  translate = $state(localStorage.getItem(KEY) === "1");
  constructor() {
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) this.translate = e.newValue === "1";
    });
  }
  toggleTranslate() {
    this.translate = !this.translate;
    localStorage.setItem(KEY, this.translate ? "1" : "0");
  }
}
export const lyricsPrefs = new LyricsPrefs();
