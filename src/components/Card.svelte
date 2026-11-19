<script lang="ts">
  // Card de vidro: inclina seguindo o ponteiro, brilho especular, capa com zoom
  // e "voo" da capa até a próxima tela ao clicar.
  import { openItem, prefetch } from "../lib/actions";
  import { songMenu } from "../lib/contextmenu.svelte";
  import { holdDrag } from "../lib/dnd.svelte";
  import { tilt } from "../lib/fx.svelte";
  import type { Item } from "../lib/types";
  import Cover from "./Cover.svelte";

  let {
    item,
    selected = false,
    onselect,
  }: { item: Item; selected?: boolean; onselect?: (item: Item, coverEl: HTMLElement) => void } = $props();

  const round = $derived(item.kind === "artist");
  const icon = $derived(item.kind === "artist" ? "user" : item.kind === "playlist" ? "playlist" : item.kind === "album" ? "album" : "note");
  let artEl = $state<HTMLElement>();
  let hoverTimer: ReturnType<typeof setTimeout>;

  function open() {
    if (onselect) onselect(item, artEl!);
    else openItem(item, artEl);
  }
</script>

<div
  class="card sheen"
  role="group"
  class:round
  class:selected
  use:tilt
  use:holdDrag={item.kind === "song" ? item : null}
  use:songMenu={item.kind === "song" ? item : null}
  onpointerenter={() => (hoverTimer = setTimeout(() => prefetch(item), 180))}
  onpointerleave={() => clearTimeout(hoverTimer)}
>
  <button class="hit" onclick={open} title={item.title}>
    <div class="art" bind:this={artEl}>
      <Cover src={item.thumb} size={264} {round} {icon} />
    </div>
    <div class="text">
      <div class="title ellipsis">{item.title}</div>
      {#if item.subtitle}<div class="sub ellipsis">{item.subtitle}</div>{/if}
    </div>
  </button>
</div>

<style>
  .card {
    position: relative;
    padding: 10px;
    border-radius: var(--radius-lg);
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015));
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
    transform: perspective(700px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
    transition:
      transform 0.5s var(--spring),
      background 0.3s,
      box-shadow 0.3s;
    /* cqw = largura do conteúdo do card (= largura da capa) */
    container-type: inline-size;
    --sheen-size: 260px;
  }
  .card:hover {
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.04));
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 0 0 1px rgba(255, 255, 255, 0.1) inset,
      0 22px 40px -16px rgba(0, 0, 0, 0.65);
    transform: perspective(700px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateY(-4px);
    transition:
      transform 0.25s var(--ease),
      background 0.3s,
      box-shadow 0.3s;
  }
  .card:active {
    transform: perspective(700px) scale(0.97);
  }
  .card.selected {
    background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 24%, transparent), color-mix(in srgb, var(--accent) 6%, transparent));
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent) inset,
      0 14px 34px -14px var(--accent-glow);
  }
  .hit {
    display: block;
    width: 100%;
    text-align: left;
  }
  .art {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
  }
  .art :global(img) {
    transition: transform 0.6s var(--ease), opacity 0.25s;
  }
  .card:hover .art :global(img) {
    transform: scale(1.07);
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
</style>
