<script lang="ts">
  // Player flutuante em cápsula de vidro; o conteúdo rola por baixo dele.
  import { sheen } from "../lib/fx.svelte";
  import { player } from "../lib/player.svelte";
  import { router } from "../lib/router.svelte";
  import { fmtTime } from "../lib/util";
  import Cover from "./Cover.svelte";
  import Icon from "./Icon.svelte";
  import Range from "./Range.svelte";

  const s = $derived(player.state);
  const volIcon = $derived(s.muted || s.volume === 0 ? "mute" : s.volume < 50 ? "volume-low" : "volume");

  function openNow(tab: "art" | "queue" | "lyrics") {
    player.openNow(player.nowPlaying === tab ? null : tab);
  }

  /** Clique em qualquer área livre da barra abre (ou fecha) o "Tocando agora". */
  function onDockClick(e: MouseEvent) {
    if (!player.hasTrack) return;
    if ((e.target as HTMLElement).closest("button, input, a, .vol-range")) return;
    openNow("art");
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<footer class="dock glass" class:clickable={player.hasTrack} use:sheen onclick={onDockClick} title={player.hasTrack ? "Abrir Tocando agora" : ""}>
  <div class="info">
    <button
      class="art"
      onclick={() => openNow("art")}
      title="Tocando agora"
      disabled={!player.hasTrack}
      style:view-transition-name={player.nowPlaying ? "none" : "np-cover"}
    >
      {#key s.thumb}
        <div class="art-in"><Cover src={s.thumb} size={120} eager /></div>
      {/key}
      <span class="expand"><Icon name="expand" size={16} /></span>
    </button>
    {#if player.hasTrack}
      {#key s.videoId}
        <div class="meta">
          <div class="title ellipsis">{s.title}</div>
          <div class="sub ellipsis">
            {#if s.artistId}
              <button class="link muted" onclick={() => router.go({ name: "artist", id: s.artistId })}>{s.artist}</button>
            {:else}
              <span class="muted">{s.artist}</span>
            {/if}
            {#if s.album}
              <span class="dot">·</span>
              {#if s.albumId}
                <button class="link faint" onclick={() => router.go({ name: "collection", id: s.albumId, thumb: s.thumb, title: s.album })}>{s.album}</button>
              {:else}<span class="faint">{s.album}</span>{/if}
            {/if}
          </div>
        </div>
      {/key}
    {:else}
      <div class="meta"><div class="muted">Nada tocando</div></div>
    {/if}
  </div>

  <div class="center">
    <div class="controls">
      <button class="icon-btn small" onclick={() => player.shuffle()} title="Aleatório"><Icon name="shuffle" size={16} /></button>
      <button class="icon-btn" onclick={() => player.prev()} title="Anterior"><Icon name="prev" size={18} /></button>
      <button class="play" class:playing={s.playing} onclick={() => player.toggle()} title={s.playing ? "Pausar" : "Tocar"} disabled={!player.hasTrack}>
        <span class="ico" class:swap={s.playing}>
          <Icon name={s.playing ? "pause" : "play"} size={20} />
        </span>
      </button>
      <button class="icon-btn" onclick={() => player.next()} title="Próxima"><Icon name="next" size={18} /></button>
      <button class="icon-btn small" class:on={s.repeat !== "NONE"} onclick={() => player.cycleRepeat()} title="Repetir">
        <Icon name="repeat" size={16} />
        {#if s.repeat === "ONE"}<span class="one">1</span>{/if}
      </button>
    </div>
    <div class="progress">
      <span class="time">{fmtTime(player.time)}</span>
      <Range label="Posição" value={player.time} max={s.duration || 1} step={0.5} oninput={(v) => player.scrub(v)} onchange={(v) => player.seek(v)} />
      <span class="time">{fmtTime(s.duration)}</span>
    </div>
  </div>

  <div class="extras">
    <button class="icon-btn heart" class:on={s.liked} class:pop={s.liked} onclick={() => player.like()} title="Curtir">
      <Icon name={s.liked ? "heart-fill" : "heart"} size={18} />
    </button>
    <div class="volume">
      <button class="icon-btn" onclick={() => player.toggleMute()} title="Volume"><Icon name={volIcon} size={18} /></button>
      <div class="vol-range">
        <Range label="Volume" value={s.muted ? 0 : s.volume} oninput={(v) => player.setVolume(v)} />
      </div>
    </div>
    <button class="icon-btn" class:on={player.nowPlaying === "lyrics"} onclick={() => openNow("lyrics")} title="Letra">
      <Icon name="lyrics" size={18} />
    </button>
    <button class="icon-btn" class:on={player.nowPlaying === "queue"} onclick={() => openNow("queue")} title="Fila">
      <Icon name="queue" size={18} />
    </button>
  </div>
</footer>

<style>
  .dock {
    position: absolute;
    left: 14px;
    right: 14px;
    bottom: 14px;
    z-index: 15;
    height: var(--playerbar);
    display: grid;
    grid-template-columns: minmax(200px, 1fr) minmax(320px, 2.2fr) minmax(200px, 1fr);
    align-items: center;
    gap: 18px;
    padding: 0 16px 0 10px;
    border-radius: var(--radius-xl);
    --sheen-size: 320px;
  }
  .dock.clickable {
    cursor: pointer;
  }
  .dock.clickable :global(button),
  .dock.clickable :global(input) {
    cursor: pointer;
  }

  .dock > * {
    position: relative;
    z-index: 2;
  }
  .info {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .art {
    position: relative;
    width: 56px;
    height: 56px;
    flex: none;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
    transition: transform 0.4s var(--spring);
  }
  .art:hover {
    transform: scale(1.06) rotate(-2deg);
  }
  .art-in {
    animation: art-in 0.5s var(--spring);
  }
  @keyframes art-in {
    from {
      opacity: 0;
      transform: scale(0.7) rotate(-8deg);
    }
  }
  .expand {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.4);
    opacity: 0;
    transition: opacity 0.2s;
  }
  .art:hover .expand {
    opacity: 1;
  }
  .meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    animation: meta-in 0.45s var(--ease);
  }
  @keyframes meta-in {
    from {
      opacity: 0;
      transform: translateY(6px);
      filter: blur(3px);
    }
  }
  .title {
    font-weight: 600;
    font-size: 14px;
  }
  .sub {
    font-size: 12px;
  }
  .dot {
    color: var(--faint);
    margin: 0 4px;
  }
  .faint {
    color: var(--faint);
  }
  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .small {
    width: 32px;
    height: 32px;
  }
  /* botão de play: orbe de vidro */
  .play {
    position: relative;
    width: 44px;
    height: 44px;
    margin: 0 4px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: #0a0a0f;
    background: radial-gradient(circle at 35% 25%, #fff, #e8eef5 55%, #c9d4df);
    box-shadow: 0 1px 0 #fff inset, 0 -3px 6px rgba(0, 0, 0, 0.15) inset, 0 8px 20px -6px rgba(0, 0, 0, 0.6);
    transition: transform 0.4s var(--spring), box-shadow 0.3s;
  }
  .play:hover {
    transform: scale(1.1);
    box-shadow: 0 1px 0 #fff inset, 0 -3px 6px rgba(0, 0, 0, 0.15) inset, 0 10px 26px -6px rgba(255, 255, 255, 0.35);
  }
  .play:active {
    transform: scale(0.9);
    transition-duration: 0.1s;
  }
  .play.playing::after {
    content: "";
    position: absolute;
    inset: -5px;
    border-radius: 50%;
    border: 1.5px solid rgba(52, 211, 226, 0.55);
    animation: pulse 2.4s ease-out infinite;
  }
  @keyframes pulse {
    0% {
      transform: scale(0.9);
      opacity: 0.9;
    }
    100% {
      transform: scale(1.35);
      opacity: 0;
    }
  }
  .ico {
    display: grid;
    animation: swap 0.35s var(--spring);
  }
  .ico.swap {
    animation-name: swap2;
  }
  @keyframes swap {
    from {
      transform: scale(0.4) rotate(-90deg);
      opacity: 0;
    }
  }
  @keyframes swap2 {
    from {
      transform: scale(0.4) rotate(90deg);
      opacity: 0;
    }
  }
  .progress {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    max-width: 640px;
  }
  .time {
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    min-width: 36px;
    text-align: center;
  }
  .extras {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 2px;
  }
  .one {
    position: absolute;
    right: 3px;
    bottom: 3px;
    font-size: 9px;
    font-weight: 700;
  }
  .heart.pop :global(svg) {
    animation: heart 0.5s var(--spring);
    color: #ff5c8a;
  }
  .heart.on {
    color: #ff5c8a;
    filter: drop-shadow(0 0 8px rgba(255, 92, 138, 0.5));
  }
  @keyframes heart {
    40% {
      transform: scale(1.4);
    }
  }
  .volume {
    display: flex;
    align-items: center;
  }
  .vol-range {
    width: 0;
    overflow: hidden;
    transition: width 0.4s var(--spring);
  }
  .volume:hover .vol-range,
  .volume:focus-within .vol-range {
    width: 96px;
    overflow: visible;
  }
  @media (max-width: 1000px) {
    .dock {
      grid-template-columns: minmax(150px, 1fr) minmax(260px, 2fr) auto;
    }
    .info .meta {
      display: none;
    }
  }
</style>
