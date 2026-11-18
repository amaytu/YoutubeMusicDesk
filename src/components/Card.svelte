<script lang="ts">
  import { openItem, playItem } from "../lib/actions";
  import type { Item } from "../lib/types";
  import Cover from "./Cover.svelte";
  import Icon from "./Icon.svelte";

  let {
    item,
    selected = false,
    onselect,
  }: { item: Item; selected?: boolean; onselect?: (item: Item) => void } = $props();

  const round = $derived(item.kind === "artist");
  const icon = $derived(item.kind === "artist" ? "user" : item.kind === "playlist" ? "playlist" : item.kind === "album" ? "album" : "note");
</script>

<div class="card" class:round class:selected>
  <button class="hit" onclick={() => (onselect ? onselect(item) : openItem(item))} title={item.title}>
    <div class="art">
      <Cover src={item.thumb} size={264} {round} {icon} />
    </div>
    <div class="text">
      <div class="title ellipsis">{item.title}</div>
      {#if item.subtitle}<div class="sub ellipsis">{item.subtitle}</div>{/if}
    </div>
  </button>
  <button class="play" onclick={() => playItem(item)} title="Tocar" aria-label="Tocar {item.title}">
    <Icon name="play" size={18} />
  </button>
</div>

<style>
  .card {
    position: relative;
    padding: 10px;
    border-radius: var(--radius-lg);
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid transparent;
    transition: background 0.18s, border-color 0.18s, transform 0.18s var(--ease);
    /* cqw = largura do card: posiciona o botão de play sobre a capa. */
    container-type: inline-size;
  }
  .card:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
  }
  .card.selected {
    border-color: rgba(43, 196, 212, 0.55);
    background: var(--accent-soft);
  }
  .hit {
    display: block;
    width: 100%;
    text-align: left;
  }
  .art {
    border-radius: 8px;
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
  }
  .round .art {
    border-radius: 50%;
  }
  .text {
    padding: 10px 2px 2px;
  }
  .round .text {
    text-align: center;
  }
  .title {
    font-weight: 600;
  }
  .sub {
    margin-top: 2px;
    font-size: 12px;
    color: var(--muted);
  }
  .play {
    position: absolute;
    /* cqw usa a caixa de conteúdo do card (= largura da capa). */
    right: 21px;
    top: calc(100cqw - 41px);
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: #031418;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.18s, transform 0.18s var(--ease);
  }
  .round .play {
    display: none;
  }
  .card:hover .play {
    opacity: 1;
    transform: none;
  }
  .play:hover {
    filter: brightness(1.1);
  }
</style>
