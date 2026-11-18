import type { Ref } from "./types";

/** Pede ao CDN do Google a miniatura no tamanho certo (menos bytes, menos RAM). */
export function thumb(url: string | undefined, size = 226): string {
  if (!url) return "";
  if (url.startsWith("//")) url = "https:" + url;
  if (/googleusercontent\.com|ggpht\.com/.test(url)) {
    const base = url.replace(/=[^/]*$/, "");
    return `${base}=w${size}-h${size}-l90-rj`;
  }
  return url;
}

export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function parseDuration(d?: string): number {
  if (!d) return 0;
  return d.split(":").reduce((acc, p) => acc * 60 + Number(p), 0);
}

export function artistsText(artists?: Ref[], fallback = ""): string {
  return artists?.length ? artists.map((a) => a.name).join(", ") : fallback;
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Guarda e restaura a rolagem de um container por chave (ex.: rota). */
const scrolls = new Map<string, number>();
export function keepScroll(node: HTMLElement, key: string) {
  let current = key;
  requestAnimationFrame(() => (node.scrollTop = scrolls.get(current) ?? 0));
  const save = () => scrolls.set(current, node.scrollTop);
  node.addEventListener("scroll", save, { passive: true });
  return {
    update(k: string) {
      current = k;
      requestAnimationFrame(() => (node.scrollTop = scrolls.get(k) ?? 0));
    },
    destroy() {
      node.removeEventListener("scroll", save);
    },
  };
}
