<script lang="ts">
  // Prateleira horizontal com setas. Músicas viram uma grade compacta
  // (como as "escolhas rápidas" do YouTube Music).
  import { songMenu } from "../lib/contextmenu.svelte";
  import { holdDrag } from "../lib/dnd.svelte";
  import { dragScroll } from "../lib/fx.svelte";
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
    <div class="row songs" bind:this={row} use:dragScroll>
      {#each shelf.items as it, i (i)}
        {@const t = asTrack(it)}
        <button class="tile" class:active={t.videoId === player.state.videoId} onclick={() => player.playTrack(t)} use:holdDrag={t} use:songMenu={t}>
          <div class="tile-art"><Cover src={t.thumb} size={96} /><span class="ov"><Icon name="play" size={14} /></span></div>
          <div class="tile-text">
            <div class="ellipsis t">{t.title}</div>
            <div class="ellipsis s">{artistsText(t.artists, t.subtitle)}</div>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <div class="row cards" class:top={shelf.top} bind:this={row} use:dragScroll>
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
  .row {
    cursor: grab;
  }
  /* durante o arraste: sem snap, sem hover/inclinação nos cards */
  .row:global(.dragging) {
    cursor: grabbing;
    scroll-snap-type: none;
    scroll-behavior: auto;
  }
  .row:global(.dragging) :global(*) {
    pointer-events: none;
  }
  .row {
    margin: 0 -8px;
    padding: 8px 8px 12px;
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
  @media (max-width: 700px) {
    .songs {
      grid-auto-columns: 82%;
    }
    .cards {
      grid-auto-columns: 148px;
      gap: 10px;
    }
    .cards.top {
      grid-auto-columns: 180px;
    }
    h2 {
      font-size: 17px;
    }
  }
  .tile {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px;
    border-radius: 14px;
    text-align: left;
    scroll-snap-align: start;
    min-width: 0;
    transition: background 0.25s, box-shadow 0.25s, transform 0.4s var(--spring);
  }
  .tile:hover {
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04));
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.18) inset, 0 0 0 1px rgba(255, 255, 255, 0.06) inset;
    transform: translateY(-2px);
  }
  .tile:active {
    transform: scale(0.97);
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
    /* mesmo vidro dos botões do app: leve escurecida + orbe de vidro */
    background: rgba(0, 0, 0, 0.22);
    border-radius: 8px;
    opacity: 0;
    transform: scale(0.7);
    transition: opacity 0.2s, transform 0.4s var(--spring);
  }
  .ov :global(svg) {
    width: 26px;
    height: 26px;
    padding: 6px;
    box-sizing: border-box;
    border-radius: 50%;
    color: #fff;
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0.08));
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.5) inset,
      0 0 0 1px rgba(255, 255, 255, 0.16) inset,
      0 4px 10px -4px rgba(0, 0, 0, 0.6);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
  }
  .tile:hover .ov {
    opacity: 1;
    transform: none;
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
