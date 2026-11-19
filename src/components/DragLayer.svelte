<script lang="ts">
  // Camada do arrastar: playlists no topo (mais recentes primeiro) e a música
  // "flutuando" junto do cursor. Solte sobre uma playlist para adicionar.
  import { backOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";
  import { dnd } from "../lib/dnd.svelte";
  import { dialog } from "../lib/dialog.svelte";
  import { playlists, type Target } from "../lib/playlists.svelte";
  import { artistsText } from "../lib/util";
  import Cover from "./Cover.svelte";
  import Icon from "./Icon.svelte";

  let targets = $state<Target[] | null>(null);
  let failed = $state(false);

  $effect(() => {
    const t = dnd.track;
    if (!t) return;
    targets = null;
    failed = false;
    playlists
      .targets(t.videoId)
      .then((list) => dnd.track === t && (targets = list))
      .catch(() => (failed = true));
  });

  const NEW = "__new__";

  // Muitas playlists: aproximar o mouse das bordas da faixa rola para o lado.
  const EDGE = 90; // px de cada borda que ativam a rolagem
  const MAX_SPEED = 22; // px por quadro no extremo
  let row = $state<HTMLDivElement>();
  let canLeft = $state(false);
  let canRight = $state(false);
  let scrolling = $state<"left" | "right" | null>(null);

  function updateEdges() {
    if (!row) return;
    canLeft = row.scrollLeft > 2;
    canRight = row.scrollLeft + row.clientWidth < row.scrollWidth - 2;
  }

  $effect(() => {
    if (!dnd.active || !row) return;
    const el = row;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const r = el.getBoundingClientRect();
      // só perto da faixa (um pouco acima/abaixo também conta)
      const nearY = dnd.y >= r.top - 40 && dnd.y <= r.bottom + 60;
      let v = 0;
      if (nearY) {
        if (dnd.x < r.left + EDGE) v = -Math.min(1, (r.left + EDGE - dnd.x) / EDGE);
        else if (dnd.x > r.right - EDGE) v = Math.min(1, (dnd.x - (r.right - EDGE)) / EDGE);
      }
      const before = el.scrollLeft;
      if (v) el.scrollLeft += Math.sign(v) * Math.max(3, Math.abs(v) ** 1.6 * MAX_SPEED);
      const moved = el.scrollLeft !== before;
      scrolling = moved ? (v < 0 ? "left" : "right") : null;
      if (moved) {
        updateEdges();
        // o cursor ficou parado mas a playlist embaixo dele mudou
        dnd.move(dnd.x, dnd.y);
      }
    };
    updateEdges();
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      scrolling = null;
    };
  });

  // lista carregou: recalcula as setas
  $effect(() => {
    targets;
    requestAnimationFrame(updateEdges);
  });
  dnd.onDrop = async (track, id) => {
    if (id === NEW) {
      const name = await dialog.prompt("Nova playlist", { placeholder: "Nome da playlist", confirm: "Criar e adicionar" });
      if (name) playlists.create(name, track);
      return;
    }
    const target = targets?.find((x) => x.playlistId === id);
    if (target) playlists.add(track, target);
  };
</script>

{#if dnd.active && dnd.track}
  <div class="bar glass" transition:fly={{ y: -40, duration: 380, easing: backOut }}>
    <div class="hint">Solte numa playlist para adicionar</div>
    <div class="rail">
    {#if canLeft}<div class="edge left" class:active={scrolling === "left"}><Icon name="back" size={18} /></div>{/if}
    {#if canRight}<div class="edge right" class:active={scrolling === "right"}><Icon name="chevron" size={18} /></div>{/if}
    <div
      class="targets"
      bind:this={row}
      onscroll={updateEdges}
      onwheel={(e) => {
        // roda do mouse também rola a faixa para os lados
        if (!row || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        e.preventDefault();
        row.scrollLeft += e.deltaY;
        dnd.move(dnd.x, dnd.y);
      }}
    >
      {#if failed}
        <p class="msg">Não foi possível carregar suas playlists.</p>
      {:else if targets === null}
        {#each Array(5) as _}<div class="target skeleton"></div>{/each}
      {:else}
        <div class="target new" class:over={dnd.overId === NEW} data-drop-id={NEW} in:fly={{ y: -12, duration: 320, easing: backOut }}>
          <div class="art plus"><Icon name="plus" size={26} /></div>
          <span class="name">Nova playlist</span>
        </div>
        {#each targets as t, i (t.playlistId)}
          <div
            class="target"
            class:over={dnd.overId === t.playlistId}
            class:has={t.contains}
            data-drop-id={t.playlistId}
            in:fly={{ y: -12, duration: 320, delay: Math.min(i, 8) * 30, easing: backOut }}
          >
            <div class="art"><Cover src={t.thumb} size={120} icon="playlist" eager={i < 10} /></div>
            <span class="name">{t.title}</span>
            {#if t.contains}<span class="tag"><Icon name="check" size={12} /> Já está</span>{/if}
          </div>
        {/each}
      {/if}
    </div>
    </div>
  </div>

  <div class="ghost" style:transform="translate({dnd.x + 14}px, {dnd.y + 10}px)" transition:fade={{ duration: 120 }}>
    <div class="g-art"><Cover src={dnd.track.thumb} size={80} eager /></div>
    <div class="g-text">
      <div class="g-title">{dnd.track.title}</div>
      <div class="g-sub">{artistsText(dnd.track.artists, dnd.track.subtitle)}</div>
    </div>
  </div>
{/if}

<style>
  .art.plus {
    width: 100%;
    aspect-ratio: 1;
    box-sizing: border-box;
    border-radius: 10px;
    display: grid;
    place-items: center;
    border: 1.5px dashed rgba(255, 255, 255, 0.28);
    background: rgba(255, 255, 255, 0.04);
    color: var(--dyn-strong, var(--accent));
  }
  .target.new.over .art.plus {
    border-color: var(--dyn-strong, var(--accent));
    background: var(--dyn-soft, var(--accent-soft));
  }
  .bar {
    position: fixed;
    z-index: 100;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    width: min(920px, calc(100vw - 20px));
    padding: 12px 14px 14px;
    border-radius: 24px;
    background: linear-gradient(160deg, rgba(30, 30, 40, 0.92), rgba(18, 18, 26, 0.92));
  }
  .bar > * {
    position: relative;
    z-index: 2;
  }
  .hint {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    margin: 0 4px 10px;
  }
  .rail {
    position: relative;
  }
  .targets {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    scrollbar-width: none;
    /* espaço para o destaque (escala) não ser cortado */
    padding: 6px 4px;
    margin: -6px -4px;
  }
  .targets::-webkit-scrollbar {
    display: none;
  }
  /* bordas: indicam que há mais playlists e onde parar o mouse para rolar */
  .edge {
    position: absolute;
    top: -6px;
    bottom: -6px;
    width: 64px;
    z-index: 3;
    display: flex;
    align-items: center;
    pointer-events: none;
    color: rgba(255, 255, 255, 0.75);
    transition: color 0.2s;
  }
  .edge.left {
    left: -4px;
    justify-content: flex-start;
    padding-left: 2px;
    background: linear-gradient(90deg, rgba(20, 20, 28, 0.95), rgba(20, 20, 28, 0));
    border-radius: 14px 0 0 14px;
  }
  .edge.right {
    right: -4px;
    justify-content: flex-end;
    padding-right: 2px;
    background: linear-gradient(270deg, rgba(20, 20, 28, 0.95), rgba(20, 20, 28, 0));
    border-radius: 0 14px 14px 0;
  }
  .edge :global(svg) {
    padding: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    transition: transform 0.25s var(--spring), background 0.2s;
  }
  .edge.active {
    color: #fff;
  }
  .edge.active :global(svg) {
    background: var(--dyn-strong, var(--accent));
    transform: scale(1.15);
  }
  .target {
    position: relative;
    flex: 0 0 104px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.05);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06) inset;
    transition: transform 0.35s var(--spring), background 0.2s, box-shadow 0.2s;
  }
  .target.skeleton {
    height: 132px;
  }
  .target.over {
    transform: translateY(4px) scale(1.08);
    background: var(--dyn-soft, var(--accent-soft));
    box-shadow:
      0 0 0 2px var(--dyn-strong, var(--accent)) inset,
      0 12px 30px -10px var(--dyn-strong, var(--accent));
  }
  .target.has {
    opacity: 0.6;
  }
  .art :global(.cover) {
    border-radius: 10px;
  }
  .name {
    font-size: 12px;
    font-weight: 600;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tag {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    background: rgba(0, 0, 0, 0.7);
  }
  .msg {
    margin: 6px 4px;
    color: var(--muted);
  }
  .ghost {
    position: fixed;
    z-index: 101;
    left: 0;
    top: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 280px;
    padding: 6px 12px 6px 6px;
    border-radius: 14px;
    background: rgba(20, 20, 28, 0.92);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12) inset, 0 16px 40px rgba(0, 0, 0, 0.55);
    pointer-events: none;
    rotate: -2deg;
  }
  .g-art {
    width: 40px;
    flex: none;
  }
  .g-text {
    min-width: 0;
  }
  .g-title,
  .g-sub {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .g-title {
    font-weight: 600;
    font-size: 13px;
  }
  .g-sub {
    font-size: 11px;
    color: var(--muted);
  }
</style>
