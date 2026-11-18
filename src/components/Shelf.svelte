<script lang="ts">
  // Prateleira horizontal com setas. Músicas viram uma grade compacta
  // (como as "escolhas rápidas" do YouTube Music).
  import { player } from "../lib/player.svelte";
  import type { Item, Shelf, Track } from "../lib/types";
  import { artistsText } from "../lib/util";
  import Card from "./Card.svelte";
  import Cover from "./Cover.svelte";
  import Icon from "./Icon.svelte";

  let { shelf }: { shelf: Shelf } = $props();

  const songsOnly = $derived(!shelf.top && shelf.items.length > 0 && shelf.items.every((i) => i.kind === "song"));
  let row = $state<HTMLDivElement>()!;

  function scroll(dir: number) {
    row.scrollBy({ left: dir * row.clientWidth * 0.85, behavior: "smooth" });
  }
  const asTrack = (i: Item) => i as Track;
</script>

<section class="shelf">
  <header>
    <h2>{shelf.title}</h2>
    <div class="arrows" class:hidden={shelf.top || shelf.items.length < 4}>
      <button class="icon-btn" onclick={() => scroll(-1)} aria-label="Anterior"><Icon name="chevron-left" size={18} /></button>
      <button class="icon-btn" onclick={() => scroll(1)} aria-label="Próximo"><Icon name="chevron" size={18} /></button>
    </div>
  </header>

  {#if songsOnly}
    <div class="row songs" bind:this={row}>
      {#each shelf.items as it, i (i)}
        {@const t = asTrack(it)}
        <button class="tile" class:active={t.videoId === player.state.videoId} onclick={() => player.playTrack(t)}>
          <div class="tile-art"><Cover src={t.thumb} size={96} /><span class="ov"><Icon name="play" size={14} /></span></div>
          <div class="tile-text">
            <div class="ellipsis t">{t.title}</div>
            <div class="ellipsis s">{artistsText(t.artists, t.subtitle)}</div>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <div class="row cards" class:top={shelf.top} bind:this={row}>
      {#each shelf.items as it, i (i)}
        <div class="cell"><Card item={it} /></div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .shelf {
    margin-bottom: 28px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 4px 10px;
  }
  h2 {
    margin: 0;
    font: 700 20px var(--font-display);
    letter-spacing: -0.01em;
  }
  .arrows {
    display: flex;
    gap: 2px;
  }
  .arrows.hidden {
    visibility: hidden;
  }
  .row {
    overflow-x: auto;
    scroll-snap-type: x proximity;
    scrollbar-width: none;
    padding: 4px 2px 8px;
  }
  .row::-webkit-scrollbar {
    display: none;
  }
  .cards {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 184px;
    gap: 12px;
  }
  .cards.top {
    grid-auto-columns: 220px;
  }
  .cell {
    scroll-snap-align: start;
  }
  .songs {
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: repeat(4, 60px);
    grid-auto-columns: minmax(300px, 30%);
    gap: 4px 12px;
  }
  .tile {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px;
    border-radius: 10px;
    text-align: left;
    scroll-snap-align: start;
    min-width: 0;
    transition: background 0.12s;
  }
  .tile:hover {
    background: rgba(255, 255, 255, 0.07);
  }
  .tile.active .t {
    color: var(--accent);
  }
  .tile-art {
    position: relative;
    width: 48px;
    flex: none;
  }
  .ov {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 8px;
    opacity: 0;
    transition: opacity 0.12s;
  }
  .tile:hover .ov {
    opacity: 1;
  }
  .tile-text {
    min-width: 0;
  }
  .t {
    font-weight: 500;
  }
  .s {
    font-size: 12px;
    color: var(--muted);
  }
</style>
