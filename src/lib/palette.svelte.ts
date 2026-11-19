// Cor que acompanha a capa da música, ajustada para contraste de leitura.
// Define no <html> as variáveis:
//   --dyn        texto (tradução, selos) — contraste >= 4.5:1 sobre o fundo escuro
//   --dyn-strong barras de progresso e detalhes
//   --dyn-soft   fundo translúcido de selos
// A troca é animada via @property (ver app.css).
import { coverColor } from "./api";
import { thumb } from "./util";

const BG_LUMINANCE = 0.0085; // ~ #121218 (fundo dos painéis)

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function luminance([r, g, b]: [number, number, number]) {
  const c = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
const contrast = (rgb: [number, number, number]) => (luminance(rgb) + 0.05) / (BG_LUMINANCE + 0.05);

/** Clareia até atingir o contraste mínimo, mantendo o tom da capa. */
function readable(h: number, s: number, l: number, min: number): [number, number, number] {
  let L = Math.max(l, 0.55);
  let rgb = hslToRgb(h, s, L);
  while (contrast(rgb) < min && L < 0.95) {
    L += 0.02;
    rgb = hslToRgb(h, s, L);
  }
  return rgb;
}

const css = ([r, g, b]: [number, number, number], a = 1) =>
  a === 1 ? `rgb(${r | 0} ${g | 0} ${b | 0})` : `rgb(${r | 0} ${g | 0} ${b | 0} / ${a})`;

class Palette {
  #current = "";
  #req = 0;

  /** Atualiza para a capa informada (chamar quando a capa muda). */
  async update(cover: string | undefined) {
    const url = thumb(cover, 60);
    if (!url || url === this.#current) return;
    this.#current = url;
    const req = ++this.#req;
    let rgb: [number, number, number] | null = null;
    try {
      rgb = await coverColor(url);
    } catch {}
    if (req !== this.#req) return; // capa mudou no meio do caminho
    this.apply(rgb);
  }

  apply(rgb: [number, number, number] | null) {
    const root = document.documentElement.style;
    if (!rgb) {
      for (const v of ["--dyn", "--dyn-strong", "--dyn-soft"]) root.removeProperty(v);
      return;
    }
    let [h, s, l] = rgbToHsl(...rgb);
    // capa sem cor: tom quase neutro, levemente quente
    if (s < 0.12) s = 0.08;
    else s = Math.min(0.9, Math.max(0.5, s));
    const text = readable(h, s, l, 4.5);
    const strong = readable(h, Math.min(0.95, s + 0.05), Math.max(l, 0.5), 3);
    root.setProperty("--dyn", css(text));
    root.setProperty("--dyn-strong", css(strong));
    root.setProperty("--dyn-soft", css(strong, 0.18));
  }
}

export const palette = new Palette();
