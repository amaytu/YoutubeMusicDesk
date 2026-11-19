// Efeitos de interface: transições entre telas, brilho que segue o ponteiro,
// inclinação 3D dos cards e preferência de "efeitos de vidro".
import { flushSync } from "svelte";
import { dnd } from "./dnd.svelte";

type VTDoc = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    finished: Promise<void>;
    ready?: Promise<void>;
    updateCallbackDone?: Promise<void>;
  };
};

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
  const t = d.startViewTransition(() => flushSync(update));
  // Uma transição nova cancela a anterior (cliques rápidos): não é erro.
  t.ready?.catch(() => {});
  t.updateCallbackDone?.catch(() => {});
  return t.finished.catch(() => {});
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

/**
 * Arrastar com o mouse para rolar na horizontal (com inércia ao soltar).
 * Um arraste não dispara o clique do item embaixo do cursor.
 */
export function dragScroll(node: HTMLElement) {
  let down = false;
  let moved = false;
  let startX = 0;
  let startLeft = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let raf = 0;
  const THRESHOLD = 6;

  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    cancelAnimationFrame(raf);
    down = true;
    moved = false;
    startX = lastX = e.clientX;
    startLeft = node.scrollLeft;
    lastT = performance.now();
    velocity = 0;
  };
  const onMove = (e: PointerEvent) => {
    if (!down) return;
    if (dnd.active) {
      down = false; // está arrastando uma música para uma playlist
      return;
    }
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) < THRESHOLD) return;
    if (!moved) {
      moved = true;
      node.setPointerCapture(e.pointerId);
      node.classList.add("dragging");
    }
    node.scrollLeft = startLeft - dx;
    const now = performance.now();
    const dt = Math.max(1, now - lastT);
    velocity = (e.clientX - lastX) / dt; // px/ms
    lastX = e.clientX;
    lastT = now;
  };
  const onUp = (e: PointerEvent) => {
    if (!down) return;
    down = false;
    if (!moved) return;
    node.releasePointerCapture?.(e.pointerId);
    // inércia
    let v = velocity * 16;
    const step = () => {
      v *= 0.94;
      node.scrollLeft -= v;
      if (Math.abs(v) > 0.4) raf = requestAnimationFrame(step);
      else node.classList.remove("dragging");
    };
    if (reducedMotion() || Math.abs(v) < 0.4) node.classList.remove("dragging");
    else raf = requestAnimationFrame(step);
  };
  // Depois de arrastar, engole o clique que o navegador dispara ao soltar.
  const onClick = (e: MouseEvent) => {
    if (moved) {
      e.preventDefault();
      e.stopPropagation();
      moved = false;
    }
  };
  const noDrag = (e: DragEvent) => e.preventDefault();

  node.addEventListener("pointerdown", onDown);
  node.addEventListener("pointermove", onMove);
  node.addEventListener("pointerup", onUp);
  node.addEventListener("pointercancel", onUp);
  node.addEventListener("click", onClick, true);
  node.addEventListener("dragstart", noDrag);
  return {
    destroy() {
      cancelAnimationFrame(raf);
      node.removeEventListener("pointerdown", onDown);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerup", onUp);
      node.removeEventListener("pointercancel", onUp);
      node.removeEventListener("click", onClick, true);
      node.removeEventListener("dragstart", noDrag);
    },
  };
}
