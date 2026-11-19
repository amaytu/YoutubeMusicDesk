<script lang="ts">
  import { player } from "../lib/player.svelte";
  import { router } from "../lib/router.svelte";
  import type { Track } from "../lib/types";
  import Cover from "./Cover.svelte";
  import { songMenu } from "../lib/contextmenu.svelte";
  import { holdDrag } from "../lib/dnd.svelte";
  import { artistsText } from "../lib/util";
  import Icon from "./Icon.svelte";

  let {
    tracks,
    playlistId,
    showArt = true,
    showAlbum = true,
    numbered = false,
    compact = false,
  }: {
    tracks: Track[];
    playlistId?: string;
    showArt?: boolean;
    showAlbum?: boolean;
    numbered?: boolean;
    compact?: boolean;
  } = $props();

  const current = $derived(player.state.videoId);

  // Renderização progressiva: listas com milhares de faixas criam DOM aos poucos.
  const STEP = 120;
  let limit = $state(STEP);
  let sentinel = $state<HTMLDivElement>();
  $effect(() => {
    tracks;
    limit = STEP;
  });
  $effect(() => {
    if (!sentinel) return;
    const io = new IntersectionObserver((es) => es[0].isIntersecting && (limit += STEP), { rootMargin: "800px" });
    io.observe(sentinel);
    return () => io.disconnect();
  });

  function artistClick(e: MouseEvent, id?: string) {
    if (!id) return;
    e.stopPropagation();
    router.go({ name: "artist", id });
  }
  function albumClick(e: MouseEvent, id?: string) {
    if (!id) return;
    e.stopPropagation();
    router.go({ name: "collection", id });
  }
</script>

<div class="list" class:compact class:no-album={!showAlbum}>
  {#each tracks.slice(0, limit) as t, i (t.videoId + i)}
    {@const active = t.videoId === current}
    <div
      class="row"
      class:active
      role="button"
      tabindex="0"
      use:holdDrag={t}
      use:songMenu={t}
      ondblclick={() => player.playTrack(t, playlistId)}
      onkeydown={(e) => e.key === "Enter" && player.playTrack(t, playlistId)}
    >
      <div class="lead">
        {#if showArt}
          <div class="thumb"><Cover src={t.thumb} size={80} /></div>
        {:else if numbered}
          <span class="num">{i + 1}</span>
        {/if}
        <button class="playbtn" class:solo={!showArt && !numbered} onclick={() => (active ? player.toggle() : player.playTrack(t, playlistId))} aria-label="Tocar">
          {#if active && player.state.playing}
            <span class="eq"><i></i><i></i><i></i></span>
          {:else}
            <Icon name="play" size={14} />
          {/if}
        </button>
      </div>
      <div class="title-cell">
        <div class="title ellipsis">{t.title}</div>
        <div class="sub-artist ellipsis">{artistsText(t.artists, t.subtitle)}</div>
      </div>
      <div class="artist ellipsis">
        {#if t.artists?.length}
          {#each t.artists as a, j}
            {#if j > 0}<span>, </span>{/if}
            <button class="link" onclick={(e) => artistClick(e, a.id)}>{a.name}</button>
          {/each}
        {:else}
          {t.subtitle ?? ""}
        {/if}
      </div>
      {#if showAlbum}
        <div class="album ellipsis">
          {#if t.album}<button class="link" onclick={(e) => albumClick(e, t.album?.id)}>{t.album.name}</button>{/if}
        </div>
      {/if}
      <div class="dur">{t.duration ?? ""}</div>
    </div>
  {/each}
  {#if limit < tracks.length}<div class="sentinel" bind:this={sentinel}></div>{/if}
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
  }
  .sentinel {
    height: 1px;
  }
  .row {
    display: grid;
    grid-template-columns: 44px minmax(0, 2.2fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 56px;
    align-items: center;
    gap: 14px;
    height: 54px;
    padding: 0 12px 0 8px;
    border-radius: 14px;
    cursor: default;
    transition: background 0.25s, box-shadow 0.25s, transform 0.35s var(--spring);
    /* Listas longas: o navegador só desenha o que está visível. */
    content-visibility: auto;
    contain-intrinsic-size: auto 54px;
  }
  .no-album .row {
    grid-template-columns: 44px minmax(0, 2fr) minmax(0, 1.2fr) 56px;
  }
  .compact .row {
    height: 44px;
    contain-intrinsic-size: auto 44px;
  }
  .row:nth-child(odd) {
    background: rgba(255, 255, 255, 0.02);
  }
  .row:hover {
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.04));
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.14) inset, 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
    transform: translateX(3px);
  }
  .row:active {
    transform: scale(0.99);
  }
  .row.active {
    background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 22%, transparent), color-mix(in srgb, var(--accent) 5%, transparent));
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.16) inset, 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent) inset;
  }
  .row.active .title {
    color: var(--accent);
  }
  .lead {
    position: relative;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
  }
  .compact .lead {
    width: 32px;
    height: 32px;
  }
  .thumb {
    width: 100%;
  }
  .thumb :global(.cover) {
    border-radius: 8px;
  }
  .num {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .playbtn {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border-radius: 8px;
    /* mesmo vidro dos botões do app: leve escurecida + orbe de vidro */
    background: rgba(0, 0, 0, 0.22);
    opacity: 0;
    transform: scale(0.6);
    transition: opacity 0.2s, transform 0.4s var(--spring);
  }
  .playbtn:not(.solo) > :global(svg) {
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
  .playbtn.solo {
    background: none;
    color: var(--muted);
    opacity: 1;
  }
  .row:hover .playbtn,
  .row.active .playbtn {
    opacity: 1;
    transform: none;
  }
  .row.active .playbtn {
    background: rgba(0, 0, 0, 0.35);
    color: var(--dyn-strong, var(--accent));
  }
  .row.active .playbtn.solo {
    background: none;
  }
  .title-cell {
    min-width: 0;
  }
  .title {
    font-weight: 500;
  }
  .sub-artist {
    display: none;
    font-size: 12px;
    color: var(--muted);
  }
  @media (max-width: 700px) {
    .row,
    .no-album .row {
      grid-template-columns: 40px minmax(0, 1fr) 44px;
      gap: 10px;
      padding: 0 8px 0 4px;
    }
    .artist,
    .album {
      display: none;
    }
    .sub-artist {
      display: block;
    }
  }
  .artist,
  .album,
  .dur {
    color: var(--muted);
    font-size: 13px;
  }
  .dur {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .eq {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 14px;
  }
  .eq i {
    width: 3px;
    background: var(--accent);
    border-radius: 1px;
    animation: eq 0.9s ease-in-out infinite;
  }
  .eq i:nth-child(2) {
    animation-delay: -0.3s;
  }
  .eq i:nth-child(3) {
    animation-delay: -0.6s;
  }
  @keyframes eq {
    0%,
    100% {
      height: 4px;
    }
    50% {
      height: 14px;
    }
  }
  @media (max-width: 1100px) {
    .row {
      grid-template-columns: 44px minmax(0, 2fr) minmax(0, 1.2fr) 56px;
    }
    .album {
      display: none;
    }
  }
</style>
