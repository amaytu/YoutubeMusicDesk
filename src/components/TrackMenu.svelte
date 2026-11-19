<script lang="ts">
  // Menu do botão direito: adicionar ou remover a música de uma playlist.
  import { backOut } from "svelte/easing";
  import { scale } from "svelte/transition";
  import { trackMenu } from "../lib/contextmenu.svelte";
  import { playlists, type Target } from "../lib/playlists.svelte";
  import { artistsText } from "../lib/util";
  import Cover from "./Cover.svelte";
  import Icon from "./Icon.svelte";

  const W = 290;
  let targets = $state<Target[] | null>(null);
  let failed = $state(false);
  let busy = $state<string | null>(null);
  let box = $state<HTMLDivElement>();
  let pos = $state({ left: 0, top: 0, origin: "top left" });

  $effect(() => {
    if (!trackMenu.open || !trackMenu.track) return;
    const t = trackMenu.track;
    targets = null;
    failed = false;
    playlists
      .targets(t.videoId)
      .then((list) => trackMenu.track === t && (targets = list))
      .catch(() => (failed = true));
  });

  // Mantém o menu dentro da janela (abre para cima/esquerda se faltar espaço).
  $effect(() => {
    if (!trackMenu.open) return;
    const h = box?.offsetHeight ?? 300;
    const right = trackMenu.x + W > innerWidth - 8;
    const up = trackMenu.y + h > innerHeight - 8;
    pos = {
      left: Math.max(8, right ? trackMenu.x - W : trackMenu.x),
      top: Math.max(8, up ? trackMenu.y - h : trackMenu.y),
      origin: `${up ? "bottom" : "top"} ${right ? "right" : "left"}`,
    };
  });

  async function toggle(t: Target) {
    const track = trackMenu.track;
    if (!track || busy) return;
    busy = t.playlistId;
    const ok = t.contains ? await playlists.remove(track, t) : await playlists.add(track, t);
    if (ok && targets) targets = targets.map((x) => (x.playlistId === t.playlistId ? { ...x, contains: !x.contains } : x));
    busy = null;
  }
</script>

<svelte:window onkeydown={(e) => trackMenu.open && e.key === "Escape" && trackMenu.close()} onblur={() => trackMenu.close()} />

{#if trackMenu.open && trackMenu.track}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="scrim" onpointerdown={() => trackMenu.close()} oncontextmenu={(e) => (e.preventDefault(), trackMenu.close())}></div>
  <div
    class="menu glass"
    bind:this={box}
    style:left="{pos.left}px"
    style:top="{pos.top}px"
    style:width="{W}px"
    style:transform-origin={pos.origin}
    transition:scale={{ start: 0.92, duration: 260, easing: backOut }}
  >
    <div class="head">
      <div class="h-art"><Cover src={trackMenu.track.thumb} size={80} eager /></div>
      <div class="h-text">
        <div class="h-title">{trackMenu.track.title}</div>
        <div class="h-sub">{artistsText(trackMenu.track.artists, trackMenu.track.subtitle)}</div>
      </div>
    </div>
    <div class="section">Adicionar ou remover da playlist</div>
    <div class="list">
      {#if failed}
        <p class="msg">Não foi possível carregar suas playlists.</p>
      {:else if targets === null}
        {#each Array(4) as _}<div class="skeleton" style="height:36px;margin:4px 6px"></div>{/each}
      {:else if targets.length === 0}
        <p class="msg">Você ainda não tem playlists próprias.</p>
      {:else}
        {#each targets as t (t.playlistId)}
          <button class="item" class:on={t.contains} disabled={busy !== null} onclick={() => toggle(t)}>
            <div class="i-art"><Cover src={t.thumb} size={60} icon="playlist" /></div>
            <span class="i-name">{t.title}</span>
            <span class="check">
              {#if busy === t.playlistId}<span class="spin"></span>
              {:else if t.contains}<Icon name="check" size={14} />{/if}
            </span>
          </button>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 90;
  }
  .menu {
    position: fixed;
    z-index: 91;
    max-height: min(460px, 70vh);
    display: flex;
    flex-direction: column;
    padding: 6px;
    border-radius: 18px;
    background: linear-gradient(160deg, rgba(34, 34, 44, 0.96), rgba(20, 20, 28, 0.96));
  }
  .menu > * {
    position: relative;
    z-index: 2;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 8px 10px;
    border-bottom: 1px solid var(--line);
  }
  .h-art {
    width: 40px;
    flex: none;
  }
  .h-text,
  .i-name {
    min-width: 0;
  }
  .h-title,
  .h-sub {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .h-title {
    font-weight: 600;
  }
  .h-sub {
    font-size: 12px;
    color: var(--muted);
  }
  .section {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 10px 10px 6px;
  }
  .list {
    overflow-y: auto;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 6px 8px;
    border-radius: 12px;
    text-align: left;
    transition: background 0.15s, transform 0.3s var(--spring);
  }
  .item:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    transform: translateX(2px);
  }
  .item:disabled {
    cursor: default;
  }
  .i-art {
    width: 32px;
    flex: none;
  }
  .i-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
  }
  .check {
    width: 22px;
    height: 22px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.25) inset;
    transition: background 0.2s, box-shadow 0.2s;
  }
  .item.on .check {
    background: var(--dyn-strong, var(--accent));
    box-shadow: none;
    color: #fff;
  }
  .spin {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .msg {
    margin: 8px 10px;
    color: var(--muted);
    font-size: 13px;
  }
</style>
