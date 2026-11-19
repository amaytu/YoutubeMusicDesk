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
    <div class="targets">
      {#if failed}
        <p class="msg">Não foi possível carregar suas playlists.</p>
      {:else if targets === null}
        {#each Array(5) as _}<div class="target skeleton"></div>{/each}
      {:else}
        <div class="target new" class:over={dnd.overId === NEW} data-drop-id={NEW} in:fly={{ y: -12, duration: 320, easing: backOut }}>
          <div class="art plus"><Icon name="plus" size={26} /></div>
          <span class="name">Nova playlist</span>
        </div>
        {#each targets.slice(0, 7) as t, i (t.playlistId)}
          <div
            class="target"
            class:over={dnd.overId === t.playlistId}
            class:has={t.contains}
            data-drop-id={t.playlistId}
            in:fly={{ y: -12, duration: 320, delay: i * 30, easing: backOut }}
          >
            <div class="art"><Cover src={t.thumb} size={120} icon="playlist" eager /></div>
            <span class="name">{t.title}</span>
            {#if t.contains}<span class="tag"><Icon name="check" size={12} /> Já está</span>{/if}
          </div>
        {/each}
      {/if}
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
  .targets {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    scrollbar-width: none;
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
