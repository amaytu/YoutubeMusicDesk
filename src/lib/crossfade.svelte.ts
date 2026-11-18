// Camadas de imagem com crossfade: a nova aparece quando termina de carregar e as
// antigas somem e são removidas logo depois. (Usado nos fundos com a capa.)
import { untrack } from "svelte";

export interface Layer {
  id: number;
  url: string;
}

export class Crossfade {
  layers = $state<Layer[]>([]);
  /** Camada visível (a última que terminou de carregar). */
  shown = $state(0);
  #n = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;

  /** Troca a imagem. Chamar de dentro de um $effect que depende só da URL. */
  set(url: string) {
    untrack(() => {
      if (!url || this.layers.at(-1)?.url === url) return;
      const id = ++this.#n;
      // mantém no máximo a visível + a nova
      this.layers = [...this.layers.filter((l) => l.id === this.shown), { id, url }];
    });
  }

  /** onload da <img>: mostra esta e agenda a remoção das anteriores. */
  loaded(id: number) {
    if (id < this.shown) return;
    this.shown = id;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => (this.layers = this.layers.filter((l) => l.id >= this.shown)), 1000);
  }
}
