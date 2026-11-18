// Navegação simples em pilha (abas + páginas de detalhe com "voltar").
export type Route =
  | { name: "home" }
  | { name: "songs" }
  | { name: "albums" }
  | { name: "artists" }
  | { name: "playlists" }
  | { name: "search"; q: string }
  | { name: "artist"; id: string }
  | { name: "collection"; id: string };

export type Tab = "home" | "songs" | "artists" | "albums" | "playlists";

export const routeKey = (r: Route) => JSON.stringify(r);

class Router {
  stack = $state<Route[]>([{ name: "home" }]);
  current = $derived(this.stack[this.stack.length - 1]);
  canGoBack = $derived(this.stack.length > 1);
  /** Aba destacada: a da raiz da pilha. */
  tab = $derived(this.stack[0].name as Tab);

  go(r: Route) {
    if (routeKey(r) === routeKey(this.current)) return;
    this.stack = [...this.stack, r].slice(-30);
  }
  tabTo(name: Tab) {
    this.stack = [{ name } as Route];
  }
  back() {
    if (this.stack.length > 1) this.stack = this.stack.slice(0, -1);
  }
}

export const router = new Router();
