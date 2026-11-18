<script lang="ts">
  // Tela "Tocando agora": a capa ocupa a tela inteira como fundo semitransparente;
  // no canto inferior esquerdo ficam capa + título e, logo abaixo, a barra de
  // progresso (até a metade da tela) com os controles. Fila e Letra abrem num
  // painel compacto no canto superior direito.
  import { backOut } from "svelte/easing";
  import { fly } from "svelte/transition";
  import { api } from "../lib/api";
  import { player } from "../lib/player.svelte";
  import { router } from "../lib/router.svelte";
  import type { Track } from "../lib/types";
  import { artistsText, fmtTime, thumb } from "../lib/util";
  import Cover from "./Cover.svelte";
  import Icon from "./Icon.svelte";
  import LyricsPanel from "./LyricsPanel.svelte";
  import Range from "./Range.svelte";

  const s = $derived(player.state);
  const tab = $derived(player.nowPlaying);
  const volIcon = $derived(s.muted || s.volume === 0 ? "mute" : s.volume < 50 ? "volume-low" : "volume");

  let queue = $state<Track[] | null>(null);
  let queueEl = $state<HTMLDivElement>();

  // Recarrega a fila quando a faixa muda (só com a aba aberta).
  $effect(() => {
    s.videoId;
    if (tab === "queue") {
      api.queue().then((q) => {
        queue = q;
        requestAnimationFrame(() => queueEl?.querySelector(".q.sel")?.scrollIntoView({ block: "center", behavior: "smooth" }));
      }).catch(() => (queue = []));
    }
  });

  // Fundo: capa em alta resolução com crossfade ao trocar de faixa.
  let layers = $state<{ id: number; url: string }[]>([]);
  let n = 0;
  $effect(() => {
    const url = thumb(s.thumb, 1200);
    if (!url || layers.at(-1)?.url === url) return;
    const id = ++n;
    layers = [...layers.slice(-1), { id, url }];
    const t = setTimeout(() => (layers = layers.filter((l) => l.id >= id)), 1000);
    return () => clearTimeout(t);
  });

  function close() {
    player.openNow(null);
  }
  function goArtist() {
    if (!s.artistId) return;
    close();
    router.go({ name: "artist", id: s.artistId });
  }
  function toggleTab(t: "queue" | "lyrics") {
    player.openNow(tab === t ? "art" : t);
  }
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && close()} />

<div class="now">
  <div class="backdrop" aria-hidden="true">
    {#each layers as l (l.id)}
      <img src={l.url} alt="" decoding="async" onload={(e) => e.currentTarget.classList.add("in")} />
    {/each}
    <div class="shade"></div>
  </div>

  <header class="top">
    <button class="icon-btn" onclick={close} title="Fechar (Esc)"><Icon name="collapse" size={22} /></button>
    <h2>Tocando agora</h2>
    <nav class="tabs">
      <button class:on={tab === "queue"} onclick={() => toggleTab("queue")}><Icon name="queue" size={16} /> Fila</button>
      <button class:on={tab === "lyrics"} onclick={() => toggleTab("lyrics")}><Icon name="lyrics" size={16} /> Letra</button>
    </nav>
  </header>

  {#if tab === "queue" || tab === "lyrics"}
    <aside class="side glass" transition:fly={{ y: -16, duration: 380, easing: backOut }}>
      {#if tab === "queue"}
        <div class="side-head">
          <span class="section-title">Tocando agora · {queue?.length ?? ""}</span>
          <button class="hide" onclick={() => player.openNow("art")}>Ocultar</button>
        </div>
        <div class="scroll" bind:this={queueEl}>
          {#if !queue}
            {#each Array(8) as _}<div class="skeleton" style="height:44px;margin:6px 0"></div>{/each}
          {:else if queue.length === 0}
            <p class="muted pad">A fila está vazia.</p>
          {:else}
            {#each queue as t (t.index)}
              <button class="q" class:sel={t.selected} onclick={() => player.playQueueItem(t)}>
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
        <LyricsPanel />
      {/if}
    </aside>
  {/if}

  <footer class="bottom">
    <div class="hero">
      <div class="art" class:playing={s.playing} style:view-transition-name="np-cover">
        <Cover src={s.thumb} size={400} eager />
      </div>
      <div class="meta">
        <h1>{s.title || "Nada tocando"}</h1>
        <button class="link artist" onclick={goArtist}>{s.artist}</button>
        {#if s.album}<div class="album">{s.album}</div>{/if}
      </div>
    </div>

    <!-- Barra de progresso e controles ocupam só a metade esquerda. -->
    <div class="half">
      <div class="progress">
        <span>{fmtTime(player.time)}</span>
        <Range label="Posição" value={player.time} max={s.duration || 1} step={0.5} oninput={(v) => player.scrub(v)} onchange={(v) => player.seek(v)} />
        <span>{fmtTime(s.duration)}</span>
      </div>
      <div class="buttons">
        <button class="icon-btn" onclick={() => player.prev()} title="Anterior"><Icon name="prev" size={20} /></button>
        <button class="play" onclick={() => player.toggle()} title={s.playing ? "Pausar" : "Tocar"}>
          <Icon name={s.playing ? "pause" : "play"} size={22} />
        </button>
        <button class="icon-btn" onclick={() => player.next()} title="Próxima"><Icon name="next" size={20} /></button>
        <button class="pill" onclick={() => player.shuffle()} title="Aleatório"><Icon name="shuffle" size={16} /></button>
        <button class="icon-btn" class:on={s.repeat !== "NONE"} onclick={() => player.cycleRepeat()} title="Repetir">
          <Icon name="repeat" size={18} />
        </button>
        <span class="spacer"></span>
        <button class="icon-btn heart" class:on={s.liked} onclick={() => player.like()} title="Curtir">
          <Icon name={s.liked ? "heart-fill" : "heart"} size={18} />
        </button>
        <div class="volume">
          <button class="icon-btn" onclick={() => player.toggleMute()} title="Volume"><Icon name={volIcon} size={18} /></button>
          <div class="vol-range"><Range label="Volume" value={s.muted ? 0 : s.volume} oninput={(v) => player.setVolume(v)} /></div>
        </div>
        <button class="icon-btn" class:on={tab === "lyrics"} onclick={() => toggleTab("lyrics")} title="Letra"><Icon name="lyrics" size={18} /></button>
        <button class="icon-btn" class:on={tab === "queue"} onclick={() => toggleTab("queue")} title="Fila"><Icon name="queue" size={18} /></button>
      </div>
    </div>
  </footer>

  <button class="icon-btn corner" onclick={close} title="Sair do Tocando agora"><Icon name="expand" size={16} /></button>
</div>

<style>
  .now {
    position: absolute;
    inset: var(--titlebar) 0 0 0;
    z-index: 30;
    overflow: hidden;
    background: #07070a;
    view-transition-name: nowplaying;
  }

  /* ---- capa em tela cheia, semitransparente ---- */
  .backdrop {
    position: absolute;
    inset: 0;
    contain: strict;
  }
  .backdrop img {
    position: absolute;
    inset: -2%;
    width: 104%;
    height: 104%;
    object-fit: cover;
    object-position: center 40%;
    opacity: 0;
    filter: blur(3px) saturate(1.1);
    transition: opacity 0.9s ease;
  }
  .backdrop img:global(.in) {
    opacity: 0.6;
  }
  .shade {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(7, 7, 10, 0.6) 0%, rgba(7, 7, 10, 0.08) 22%, rgba(7, 7, 10, 0.1) 52%, rgba(7, 7, 10, 0.88) 100%),
      linear-gradient(90deg, rgba(7, 7, 10, 0.45) 0%, rgba(7, 7, 10, 0) 55%);
  }

  /* ---- topo ---- */
  .top {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 18px 26px 0 16px;
  }
  h2 {
    flex: 1;
    margin: 0;
    font: 300 28px var(--font-display);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-shadow: 0 2px 16px rgba(0, 0, 0, 0.5);
  }
  .tabs {
    display: flex;
    gap: 4px;
  }
  .tabs button {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.8);
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.5);
    transition: background 0.2s, color 0.2s, transform 0.35s var(--spring);
  }
  .tabs button:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }
  .tabs button:active {
    transform: scale(0.95);
  }
  .tabs button.on {
    color: #fff;
    background: rgba(255, 255, 255, 0.16);
  }

  /* ---- painel (fila / letra) no canto superior direito ---- */
  .side {
    position: absolute;
    z-index: 3;
    top: 64px;
    right: 22px;
    bottom: 64px;
    width: min(380px, 36vw);
    display: flex;
    flex-direction: column;
    border-radius: 18px;
    transform-origin: top right;
  }
  .side > * {
    position: relative;
    z-index: 2;
  }
  .side-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px 8px;
  }
  .hide {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .hide:hover {
    color: var(--text);
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px 12px;
  }
  .pad {
    padding: 16px;
  }
  .q {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 7px 10px;
    border-radius: 10px;
    text-align: left;
    transition: background 0.2s, transform 0.35s var(--spring);
  }
  .q:hover {
    background: rgba(255, 255, 255, 0.09);
    transform: translateX(3px);
  }
  .q.sel {
    background: var(--accent-soft);
  }
  .q.sel .t {
    color: var(--accent);
  }
  .q-text {
    flex: 1;
    min-width: 0;
  }
  .t {
    font-weight: 600;
    font-size: 13px;
  }
  .s,
  .d {
    font-size: 11px;
    color: var(--muted);
  }

  /* ---- canto inferior esquerdo ---- */
  .bottom {
    position: absolute;
    z-index: 2;
    left: 26px;
    right: 26px;
    bottom: 18px;
  }
  .hero {
    display: flex;
    align-items: flex-end;
    gap: 18px;
    margin-bottom: 18px;
  }
  .art {
    width: clamp(96px, 15vh, 140px);
    flex: none;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
    transition: transform 0.5s var(--ease);
    transform: scale(0.97);
  }
  .art.playing {
    transform: none;
  }
  .meta {
    min-width: 0;
    padding-bottom: 4px;
    text-shadow: 0 2px 14px rgba(0, 0, 0, 0.55);
  }
  h1 {
    margin: 0 0 4px;
    font: 700 clamp(22px, 2.6vw, 34px) / 1.1 var(--font-display);
  }
  .artist {
    font-size: 15px;
    color: rgba(255, 255, 255, 0.85);
  }
  .album {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 2px;
  }

  /* a "metade" da tela */
  .half {
    width: clamp(460px, 50%, 820px);
  }
  .progress {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.75);
    font-variant-numeric: tabular-nums;
  }
  .buttons {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
  }
  .spacer {
    flex: 1;
  }
  .play {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    border: 2px solid rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.06);
    transition: transform 0.4s var(--spring), background 0.2s;
  }
  .play:hover {
    transform: scale(1.08);
    background: rgba(255, 255, 255, 0.16);
  }
  .play:active {
    transform: scale(0.92);
  }
  .pill {
    width: 34px;
    height: 34px;
    margin-left: 4px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: #031418;
    transition: transform 0.4s var(--spring), filter 0.2s;
  }
  .pill:hover {
    transform: scale(1.1);
    filter: brightness(1.1);
  }
  .heart.on {
    color: #ff5c8a;
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
    width: 90px;
    overflow: visible;
  }
  .corner {
    position: absolute;
    z-index: 2;
    right: 18px;
    bottom: 18px;
  }
</style>
