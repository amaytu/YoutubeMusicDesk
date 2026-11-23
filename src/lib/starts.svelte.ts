// Início personalizado por música (pular introduções longas).
import { playerCmd } from "./api";
import type { Track } from "./types";

const KEY = "ymd.startAt";

export interface StartEntry {
  start: number;
  title: string;
  artist: string;
  thumb?: string;
}

/** "2:15", "135", "1:02:03" -> segundos. null = inválido. */
export function parseTime(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!t) return 0;
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(t)) return null;
  const parts = t.split(":").map(Number);
  if (parts.slice(1).some((n) => n >= 60)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function formatTime(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

class Starts {
  list = $state<Record<string, StartEntry>>({});

  constructor() {
    try {
      this.list = JSON.parse(localStorage.getItem(KEY) ?? "{}") || {};
    } catch {}
    // O player guarda a própria cópia; manda a lista ao abrir (e após recarregar).
    setTimeout(() => this.#sync(), 1500);
  }

  get(videoId: string): number {
    return this.list[videoId]?.start ?? 0;
  }

  set(track: Track, start: number) {
    const { [track.videoId]: _, ...rest } = this.list;
    this.list =
      start > 0
        ? {
            ...rest,
            [track.videoId]: {
              start,
              title: track.title,
              artist: track.artists?.map((a) => a.name).join(", ") || track.subtitle || "",
              thumb: track.thumb,
            },
          }
        : rest;
    this.#save();
  }

  remove(videoId: string) {
    const { [videoId]: _, ...rest } = this.list;
    this.list = rest;
    this.#save();
  }

  #save() {
    localStorage.setItem(KEY, JSON.stringify(this.list));
    this.#sync();
  }

  sync() {
    this.#sync();
  }
  #sync() {
    const map: Record<string, number> = {};
    for (const [id, e] of Object.entries(this.list)) map[id] = e.start;
    playerCmd("setStartTimes", map);
  }
}

export const starts = new Starts();
