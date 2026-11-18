<script lang="ts">
  // Tela "Tocando agora": capa grande sobre o fundo desfocado, controles e
  // painel lateral com Fila ou Letra.
  import { fly } from "svelte/transition";
  import { api } from "../lib/api";
  import { player } from "../lib/player.svelte";
  import { router } from "../lib/router.svelte";
  import type { Lyrics, Track } from "../lib/types";
  import { artistsText, fmtTime } from "../lib/util";
  import Background from "./Background.svelte";
  import Cover from "./Cover.svelte";
  import Icon from "./Icon.svelte";
  import Range from "./Range.svelte";

  const s = $derived(player.state);
  const tab = $derived(player.nowPlaying);

  let queue = $state<Track[] | null>(null);
  let lyrics = $state<Lyrics | null | undefined>(undefined);
  let queueEl = $state<HTMLDivElement>();

  // Recarrega a fila/letra quando a faixa muda (só a aba aberta).
  $effect(() => {
    const vid = s.videoId;
    if (tab === "queue") {
      api.queue().then((q) => {
        queue = q;
        requestAnimationFrame(() => queueEl?.querySelector(".q.sel")?.scrollIntoView({ block: "center", behavior: "smooth" }));
      }).catch(() => (queue = []));
    } else if (tab === "lyrics" && vid) {
      lyrics = undefined;
      api.lyrics(vid).then((l) => (lyrics = l)).catch(() => (lyrics = null));
    }
  });

  function close() {
    player.nowPlaying = null;
  }
  function goArtist() {
    if (!s.artistId) return;
    close();
    router.go({ name: "artist", id: s.artistId });
  }
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && close()} />

<div class="now" transition:fly={{ y: 40, duration: 260, opacity: 0 }}>
  <Background src={s.thumb} strength={1.1} />

  <div class="top">
    <button class="icon-btn" onclick={close} title="Fechar (Esc)"><Icon name="collapse" size={22} /></button>
    <h2>Tocando agora</h2>
    <div class="tabs">
      <button class:on={tab === "queue"} onclick={() => (player.nowPlaying = tab === "queue" ? "art" : "queue")}>
        <Icon name="queue" size={16} /> Fila
      </button>
      <button class:on={tab === "lyrics"} onclick={() => (player.nowPlaying = tab === "lyrics" ? "art" : "lyrics")}>
        <Icon name="lyrics" size={16} /> Letra
      </button>
    </div>
  </div>

  <div class="body">
    <div class="hero">
      <div class="big-art" class:playing={s.playing}><Cover src={s.thumb} size={544} eager /></div>
      <div class="meta">
        <h1>{s.title || "Nada tocando"}</h1>
        <button class="link artist" onclick={goArtist}>{s.artist}</button>
        {#if s.album}<div class="album">{s.album}</div>{/if}
      </div>
    </div>

    {#if tab === "queue" || tab === "lyrics"}
      <aside class="side glass" transition:fly={{ x: 30, duration: 220 }}>
        {#if tab === "queue"}
          <div class="side-head"><span class="section-title">A seguir</span><span class="muted">{queue?.length ?? ""}</span></div>
          <div class="scroll" bind:this={queueEl}>
            {#if !queue}
              {#each Array(8) as _}<div class="skeleton" style="height:48px;margin:6px 0"></div>{/each}
            {:else if queue.length === 0}
              <p class="muted pad">A fila está vazia.</p>
            {:else}
              {#each queue as t (t.index)}
                <button class="q" class:sel={t.selected} onclick={() => player.playQueueIndex(t.index!)}>
                  <div class="q-art"><Cover src={t.thumb} size={80} /></div>
                  <div class="q-text">
                    <div class="ellipsis t">{t.title}</div>
                    <div class="ellipsis s">{t.subtitle || artistsText(t.artists)}</div>
                  </div>
                  <span class="d">{t.duration}</span>
                </button>
              {/each}
            {/if}
          </div>
        {:else}
          <div class="scroll lyrics">
            {#if lyrics === undefined}
              {#each Array(10) as _, i}<div class="skeleton" style="height:18px;margin:12px auto;width:{50 + ((i * 37) % 40)}%"></div>{/each}
            {:else if lyrics === null}
              <p class="muted pad">Letra não disponível para esta música.</p>
            {:else}
              <pre>{lyrics.text}</pre>
              <small>{lyrics.source}</small>
            {/if}
          </div>
        {/if}
      </aside>
    {/if}
  </div>

  <div class="controls">
    <div class="progress">
      <span>{fmtTime(player.time)}</span>
      <Range label="Posição" value={player.time} max={s.duration || 1} step={0.5} oninput={(v) => player.scrub(v)} onchange={(v) => player.seek(v)} />
      <span>{fmtTime(s.duration)}</span>
    </div>
    <div class="buttons">
      <button class="icon-btn" onclick={() => player.shuffle()} title="Aleatório"><Icon name="shuffle" size={20} /></button>
      <button class="icon-btn" onclick={() => player.prev()} title="Anterior"><Icon name="prev" size={22} /></button>
      <button class="play" onclick={() => player.toggle()} title={s.playing ? "Pausar" : "Tocar"}><Icon name={s.playing ? "pause" : "play"} size={26} /></button>
      <button class="icon-btn" onclick={() => player.next()} title="Próxima"><Icon name="next" size={22} /></button>
      <button class="icon-btn" class:on={s.repeat !== "NONE"} onclick={() => player.cycleRepeat()} title="Repetir"><Icon name="repeat" size={20} /></button>
      <span class="spacer"></span>
      <button class="icon-btn" class:on={s.liked} onclick={() => player.like()} title="Curtir"><Icon name={s.liked ? "heart-fill" : "heart"} size={20} /></button>
    </div>
  </div>
</div>

<style>
  .now {
    position: absolute;
    inset: var(--titlebar) 0 0 0;
    z-index: 30;
    display: grid;
    grid-template-rows: auto 1fr auto;
    overflow: hidden;
    background: var(--bg);
  }
  .top,
  .body,
  .controls {
    position: relative;
    z-index: 1;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 24px 0 16px;
  }
  h2 {
    margin: 0;
    font: 700 22px var(--font-display);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    flex: 1;
  }
  .tabs {
    display: flex;
    gap: 6px;
  }
  .tabs button {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    transition: background 0.15s, color 0.15s;
  }
  .tabs button:hover {
    color: var(--text);
    background: var(--panel-hover);
  }
  .tabs button.on {
    color: var(--text);
    background: rgba(255, 255, 255, 0.12);
  }
  .body {
    display: flex;
    gap: 24px;
    min-height: 0;
    padding: 12px 32px;
  }
  .hero {
    flex: 1;
    display: flex;
    align-items: flex-end;
    gap: 28px;
    min-width: 0;
  }
  .big-art {
    width: clamp(160px, 26vh, 280px);
    flex: none;
    transition: transform 0.5s var(--ease);
    transform: scale(0.96);
  }
  .big-art.playing {
    transform: none;
  }
  .big-art :global(.cover) {
    border-radius: 14px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
  }
  .meta {
    min-width: 0;
    padding-bottom: 6px;
  }
  h1 {
    margin: 0 0 6px;
    font: 700 clamp(26px, 3.6vw, 46px) / 1.08 var(--font-display);
    letter-spacing: -0.02em;
  }
  .artist {
    font-size: 18px;
    color: var(--text);
    opacity: 0.85;
  }
  .album {
    color: var(--muted);
    margin-top: 2px;
  }
  .side {
    width: min(400px, 38vw);
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: rgba(12, 12, 18, 0.55);
  }
  .side-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px 6px;
  }
  .scroll {
    overflow-y: auto;
    padding: 4px 8px 12px;
    flex: 1;
  }
  .pad {
    padding: 16px;
  }
  .q {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 6px 8px;
    border-radius: 8px;
    text-align: left;
    transition: background 0.12s;
  }
  .q:hover {
    background: rgba(255, 255, 255, 0.07);
  }
  .q.sel {
    background: var(--accent-soft);
  }
  .q.sel .t {
    color: var(--accent);
  }
  .q-art {
    width: 40px;
    flex: none;
  }
  .q-text {
    flex: 1;
    min-width: 0;
  }
  .t {
    font-weight: 500;
  }
  .s,
  .d {
    font-size: 12px;
    color: var(--muted);
  }
  .lyrics {
    text-align: center;
    padding: 18px 20px;
  }
  pre {
    margin: 0;
    white-space: pre-wrap;
    font: 600 19px/1.75 var(--font-display);
    user-select: text;
  }
  small {
    display: block;
    margin-top: 18px;
    color: var(--faint);
  }
  .controls {
    padding: 8px 32px 22px;
  }
  .progress {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .buttons {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
  }
  .spacer {
    flex: 1;
  }
  .play {
    width: 58px;
    height: 58px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #fff;
    color: #0b0b0f;
    transition: transform 0.15s var(--ease);
  }
  .play:hover {
    transform: scale(1.06);
  }
  .play:active {
    transform: scale(0.95);
  }
</style>
