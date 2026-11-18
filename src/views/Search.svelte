<script lang="ts">
  import Shelf from "../components/Shelf.svelte";
  import Status from "../components/Status.svelte";
  import TrackList from "../components/TrackList.svelte";
  import { api } from "../lib/api";
  import type { Track } from "../lib/types";
  import { keepScroll } from "../lib/util";

  let { q }: { q: string } = $props();
  let attempt = $state(0);
  const data = $derived.by(() => { attempt; return api.search(q); });
  const isSongs = (items: { kind: string }[]) => items.length > 0 && items.every((i) => i.kind === "song");
</script>

<div class="page" use:keepScroll={"search:" + q}>
  <h1>Resultados para “{q}”</h1>
  {#await data}
    {#each Array(2) as _}
      <div class="skeleton" style="height:22px;width:200px;margin:8px 4px 14px"></div>
      {#each Array(4) as _}<div class="skeleton" style="height:48px;margin:6px 0"></div>{/each}
    {/each}
  {:then shelves}
    {#each shelves as shelf, i (i)}
      {#if isSongs(shelf.items) && !shelf.top}
        <section class="songs">
          <h2>{shelf.title}</h2>
          <TrackList tracks={shelf.items as Track[]} />
        </section>
      {:else}
        <Shelf {shelf} />
      {/if}
    {:else}
      <Status icon="search" title="Nada encontrado" message="Tente outros termos." />
    {/each}
  {:catch e}
    <Status title="A busca falhou" message={String(e)} action="Tentar de novo" onaction={() => attempt++} />
  {/await}
</div>

<style>
  .page {
    height: 100%;
    overflow-y: auto;
    padding: 4px 24px var(--player-space);
  }
  h1 {
    margin: 4px 4px 18px;
    font: 700 28px var(--font-display);
    letter-spacing: -0.02em;
  }
  h2 {
    margin: 0 4px 10px;
    font: 700 20px var(--font-display);
  }
  .songs {
    margin-bottom: 28px;
  }
</style>
