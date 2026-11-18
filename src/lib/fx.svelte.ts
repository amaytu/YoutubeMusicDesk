// Efeitos de interface: transições entre telas, brilho que segue o ponteiro,
// inclinação 3D dos cards e preferência de "efeitos de vidro".
import { flushSync } from "svelte";

type VTDoc = Document & { startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> } };

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Executa `update` dentro de uma View Transition (Chromium/WebView2).
 * Sem suporte, ou com movimento reduzido, só aplica a mudança.
 */
export function vt(update: () => void): Promise<void> {
  const d = document as VTDoc;
  if (!d.startViewTransition || reducedMotion() || document.hidden) {
    update();
    return Promise.resolve();
  }
  return d.startViewTransition(() => flushSync(update)).finished.catch(() => {});
}

/** Dá um view-transition-name temporário ao elemento (para o morph da capa). */
export function morphFrom(el: Element | null | undefined, name = "hero-cover") {
  if (!(el instanceof HTMLElement)) return;
  el.style.viewTransitionName = name;
  setTimeout(() => (el.style.viewTransitionName = ""), 700);
}

/** Atualiza --mx/--my com a posição do ponteiro (brilho especular do vidro). */
export function sheen(node: HTMLElement) {
  let raf = 0;
  const move = (e: PointerEvent) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = node.getBoundingClientRect();
      node.style.setProperty("--mx", `${e.clientX - r.left}px`);
      node.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  };
  node.addEventListener("pointermove", move, { passive: true });
  return {
    destroy() {
      cancelAnimationFrame(raf);
      node.removeEventListener("pointermove", move);
    },
  };
}

/** Inclinação 3D sutil seguindo o ponteiro + brilho. */
export function tilt(node: HTMLElement, max = 5) {
  let raf = 0;
  const move = (e: PointerEvent) => {
    if (raf || reducedMotion()) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = node.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      node.style.setProperty("--rx", `${(0.5 - y) * max}deg`);
      node.style.setProperty("--ry", `${(x - 0.5) * max}deg`);
      node.style.setProperty("--mx", `${e.clientX - r.left}px`);
      node.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  };
  const leave = () => {
    node.style.setProperty("--rx", "0deg");
    node.style.setProperty("--ry", "0deg");
  };
  node.addEventListener("pointermove", move, { passive: true });
  node.addEventListener("pointerleave", leave);
  return {
    destroy() {
      cancelAnimationFrame(raf);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", leave);
    },
  };
}

// ------------------------------------------------------------------ efeitos de vidro
const KEY = "ymd.glass";
class Appearance {
  glass = $state(localStorage.getItem(KEY) !== "off");
  constructor() {
    this.#apply();
  }
  toggleGlass() {
    this.glass = !this.glass;
    localStorage.setItem(KEY, this.glass ? "on" : "off");
    this.#apply();
  }
  #apply() {
    document.documentElement.classList.toggle("solid", !this.glass);
  }
}
export const appearance = new Appearance();
