// Navegação simples em pilha (abas + páginas de detalhe com "voltar").
// Toda troca de tela passa por uma View Transition.
import { vt } from "./fx.svelte";

/** Dicas para a próxima tela já mostrar capa/título enquanto os dados chegam. */
export interface Hint {
  thumb?: string;
  title?: string;
}

export type Route =
  | { name: "home" }
  | { name: "songs" }
  | { name: "albums" }
  | { name: "artists" }
  | { name: "playlists" }
  | { name: "search"; q: string }
  | ({ name: "artist"; id: string } & Hint)
  | ({ name: "collection"; id: string } & Hint);

export type Tab = "home" | "songs" | "artists" | "albums" | "playlists";

/** Chave estável da rota (sem as dicas). */
export const routeKey = (r: Route) =>
  r.name + ":" + ("id" in r ? r.id : "q" in r ? r.q : "");

class Router {
  stack = $state<Route[]>([{ name: "home" }]);
  current = $derived(this.stack[this.stack.length - 1]);
  canGoBack = $derived(this.stack.length > 1);
  /** Aba destacada: a da raiz da pilha. */
  tab = $derived(this.stack[0].name as Tab);

  go(r: Route) {
    if (routeKey(r) === routeKey(this.current)) return;
    vt(() => (this.stack = [...this.stack, r].slice(-30)));
  }
  tabTo(name: Tab) {
    if (this.stack.length === 1 && this.current.name === name) return;
    vt(() => (this.stack = [{ name } as Route]));
  }
  back() {
    if (this.stack.length > 1) vt(() => (this.stack = this.stack.slice(0, -1)));
  }
}

export const router = new Router();
