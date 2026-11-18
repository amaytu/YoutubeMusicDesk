<script lang="ts">
  import { player } from "../lib/player.svelte";
  import { router } from "../lib/router.svelte";
  import { fmtTime } from "../lib/util";
  import Cover from "./Cover.svelte";
  import Icon from "./Icon.svelte";
  import Range from "./Range.svelte";

  const s = $derived(player.state);
  const volIcon = $derived(s.muted || s.volume === 0 ? "mute" : s.volume < 50 ? "volume-low" : "volume");

  function openNow(tab: "art" | "queue" | "lyrics") {
    player.nowPlaying = player.nowPlaying === tab ? null : tab;
  }
</script>

<footer class="bar">
  <div class="info">
    <button class="art" onclick={() => openNow("art")} title="Tocando agora" disabled={!player.hasTrack}>
      <Cover src={s.thumb} size={120} eager />
      <span class="expand"><Icon name="expand" size={16} /></span>
    </button>
    {#if player.hasTrack}
      <div class="meta">
        <div class="title ellipsis">{s.title}</div>
        <div class="sub ellipsis">
          {#if s.artistId}
            <button class="link muted" onclick={() => router.go({ name: "artist", id: s.artistId })}>{s.artist}</button>
          {:else}
            <span class="muted">{s.artist}</span>
          {/if}
        </div>
        {#if s.album}
          <div class="sub ellipsis">
            {#if s.albumId}
              <button class="link faint" onclick={() => router.go({ name: "collection", id: s.albumId })}>{s.album}</button>
            {:else}<span class="faint">{s.album}</span>{/if}
          </div>
        {/if}
      </div>
    {:else}
      <div class="meta"><div class="muted">Nada tocando</div></div>
    {/if}
  </div>

  <div class="controls">
    <button class="icon-btn" onclick={() => player.prev()} title="Anterior"><Icon name="prev" size={18} /></button>
    <button class="play" onclick={() => player.toggle()} title={s.playing ? "Pausar" : "Tocar"} disabled={!player.hasTrack}>
      <Icon name={s.playing ? "pause" : "play"} size={20} />
    </button>
    <button class="icon-btn" onclick={() => player.next()} title="Próxima"><Icon name="next" size={18} /></button>
  </div>

  <div class="progress">
    <span class="time">{fmtTime(player.time)}</span>
    <Range
      label="Posição"
      value={player.time}
      max={s.duration || 1}
      step={0.5}
      oninput={(v) => player.scrub(v)}
      onchange={(v) => player.seek(v)}
    />
    <span class="time">{fmtTime(s.duration)}</span>
  </div>

  <div class="modes">
    <button class="pill" onclick={() => player.shuffle()} title="Aleatório"><Icon name="shuffle" size={16} /></button>
    <button class="icon-btn" class:on={s.repeat !== "NONE"} onclick={() => player.cycleRepeat()} title="Repetir">
      <Icon name="repeat" size={18} />
      {#if s.repeat === "ONE"}<span class="one">1</span>{/if}
    </button>
  </div>

  <div class="extras">
    <button class="icon-btn" class:on={s.liked} onclick={() => player.like()} title="Curtir">
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
  .bar {
    position: relative;
    z-index: 15;
    height: var(--playerbar);
    display: grid;
    grid-template-columns: minmax(200px, 300px) auto 1fr auto auto;
    align-items: center;
    gap: 18px;
    padding: 0 18px 0 14px;
    background: rgba(10, 10, 14, 0.55);
    border-top: 1px solid var(--line);
  }
  .info {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .art {
    position: relative;
    width: 58px;
    flex: none;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  }
  .expand {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.45);
    opacity: 0;
    transition: opacity 0.15s;
  }
  .art:hover .expand {
    opacity: 1;
  }
  .meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .title {
    font-weight: 600;
    font-size: 15px;
  }
  .sub {
    font-size: 12px;
  }
  .faint {
    color: var(--faint);
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .play {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    border: 2px solid rgba(255, 255, 255, 0.85);
    transition: transform 0.15s var(--ease), background 0.15s;
  }
  .play:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: scale(1.05);
  }
  .play:active {
    transform: scale(0.95);
  }
  .progress {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .time {
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    min-width: 38px;
    text-align: center;
  }
  .modes,
  .extras {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .pill {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: #031418;
    transition: transform 0.15s var(--ease), filter 0.15s;
  }
  .pill:hover {
    filter: brightness(1.12);
  }
  .pill:active {
    transform: scale(0.92);
  }
  .icon-btn {
    position: relative;
  }
  .one {
    position: absolute;
    right: 5px;
    bottom: 5px;
    font-size: 9px;
    font-weight: 700;
  }
  .volume {
    display: flex;
    align-items: center;
  }
  .vol-range {
    width: 90px;
  }
  @media (max-width: 1180px) {
    .vol-range {
      display: none;
    }
  }
  @media (max-width: 1000px) {
    .bar {
      grid-template-columns: minmax(160px, 240px) auto 1fr auto;
    }
    .modes {
      display: none;
    }
  }
</style>
