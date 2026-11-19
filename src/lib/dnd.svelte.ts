// Segurar e arrastar uma música até uma playlist.
// Segure o botão esquerdo ~0,3 s sobre qualquer música (lista, fila, cards):
// ela "descola" e aparecem as playlists no topo; solte em uma para adicionar.
// Mover o mouse antes de completar o tempo cancela (cliques, rolagem e
// arrastar prateleiras continuam funcionando normalmente).
import type { Track } from "./types";

const HOLD_MS = 320;
const MOVE_TOLERANCE = 6;

class Dnd {
  active = $state(false);
  track = $state<Track | null>(null);
  x = $state(0);
  y = $state(0);
  overId = $state<string | null>(null);
  /** Chamado ao soltar sobre um destino (registrado pela camada de arrastar). */
  onDrop: ((track: Track, targetId: string) => void) | null = null;

  begin(track: Track, x: number, y: number) {
    this.track = track;
    this.x = x;
    this.y = y;
    this.overId = null;
    this.active = true;
    document.documentElement.classList.add("dragging-track");
  }
  move(x: number, y: number) {
    this.x = x;
    this.y = y;
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop-id]");
    this.overId = el?.dataset.dropId ?? null;
  }
  drop() {
    const { track, overId } = this;
    this.cancel();
    if (track && overId) this.onDrop?.(track, overId);
  }
  cancel() {
    this.active = false;
    this.track = null;
    this.overId = null;
    document.documentElement.classList.remove("dragging-track");
  }
}

export const dnd = new Dnd();

/** use:holdDrag={track} — ativa o segurar-e-arrastar no elemento. */
export function holdDrag(node: HTMLElement, track: Track | null | undefined) {
  let current = track;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  let start = { x: 0, y: 0 };

  const cleanupPending = () => {
    clearTimeout(timer);
    clearTimeout(pendingTimer);
    timer = undefined;
    node.classList.remove("hold-pending");
    window.removeEventListener("pointermove", pendingMove);
    window.removeEventListener("pointerup", cleanupPending);
    window.removeEventListener("pointercancel", cleanupPending);
  };
  const pendingMove = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE) cleanupPending();
  };

  const dragMove = (e: PointerEvent) => {
    // botão já solto (ex.: soltou fora da janela): encerra sem adicionar
    if (e.buttons === 0) return abort();
    dnd.move(e.clientX, e.clientY);
  };
  const stopListening = () => {
    window.removeEventListener("pointermove", dragMove);
    window.removeEventListener("pointerup", dragEnd);
    window.removeEventListener("pointercancel", abort);
    window.removeEventListener("blur", abort);
    window.removeEventListener("keydown", onKey, true);
  };
  const abort = () => {
    stopListening();
    dnd.cancel();
  };
  const dragEnd = () => {
    stopListening();
    // o navegador dispara um "click" ao soltar: não deve tocar/abrir nada
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, true), 0);
    dnd.drop();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    abort();
  };
  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDown = (e: PointerEvent) => {
    if (!current?.videoId || e.button !== 0 || dnd.active) return;
    if ((e.target as HTMLElement).closest("input, select, textarea")) return;
    start = { x: e.clientX, y: e.clientY };
    window.addEventListener("pointermove", pendingMove);
    window.addEventListener("pointerup", cleanupPending);
    window.addEventListener("pointercancel", cleanupPending);
    // pequeno retorno visual de que está "pegando"
    pendingTimer = setTimeout(() => timer && node.classList.add("hold-pending"), 110);
    timer = setTimeout(() => {
      const t = current;
      cleanupPending();
      timer = undefined;
      if (!t) return;
      dnd.begin(t, start.x, start.y);
      window.addEventListener("pointermove", dragMove);
      window.addEventListener("pointerup", dragEnd);
      window.addEventListener("pointercancel", abort);
      window.addEventListener("blur", abort);
      window.addEventListener("keydown", onKey, true);
    }, HOLD_MS);
  };

  node.addEventListener("pointerdown", onDown);
  return {
    update(t: Track | null | undefined) {
      current = t;
    },
    destroy() {
      cleanupPending();
      // o elemento pode sumir no meio do arraste (lista recarregou): a camada
      // continua funcionando porque os ouvintes estão na janela.
      node.removeEventListener("pointerdown", onDown);
    },
  };
}
