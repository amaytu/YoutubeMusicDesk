<script lang="ts">
  // Tela "Tocando agora": a capa ocupa a tela inteira como fundo semitransparente;
  // no canto inferior esquerdo ficam capa + título e, logo abaixo, a barra de
  // progresso (até a metade da tela) com os controles. Fila e Letra abrem num
  // painel compacto no canto superior direito.
  import { backOut } from "svelte/easing";
  import { fly } from "svelte/transition";
  import { api, playerCmd } from "../lib/api";
  import { player, type NowTab } from "../lib/player.svelte";
  import { router } from "../lib/router.svelte";
  import type { Track } from "../lib/types";
  import { artistsText, fmtTime, thumb } from "../lib/util";
  import { songMenu } from "../lib/contextmenu.svelte";
  import { Crossfade } from "../lib/crossfade.svelte";
  import { holdDrag } from "../lib/dnd.svelte";
  import Cover from "./Cover.svelte";
  import Icon from "./Icon.svelte";
  import LyricsPanel from "./LyricsPanel.svelte";
  import Range from "./Range.svelte";

  const s = $derived(player.state);
  /** Música atual como Track (para arrastar/menu). */
  const current = $derived(
    s.videoId
      ? ({ kind: "song", videoId: s.videoId, title: s.title, thumb: s.thumb, artists: [{ name: s.artist, id: s.artistId || undefined }] } as Track)
      : null,
  );
  const tab = $derived(player.nowPlaying);
  const volIcon = $derived(s.muted || s.volume === 0 ? "mute" : s.volume < 50 ? "volume-low" : "volume");

  let queue = $state<Track[] | null>(null);
  let queueEl = $state<HTMLDivElement>();
  let chips = $state<{ index: number; label: string; selected: boolean }[]>([]);
  let chipBusy = $state(false);
  /** Filtros padrão quando a fila atual não é um mix automático. */
  const DEFAULT_CHIPS = ["Tudo", "Conhecidas", "Em alta", "Descobrir"];

  /** "A seguir" = só o que vem depois da faixa atual. */
  const upNext = $derived.by(() => {
    if (!queue) return null;
    const i = queue.findIndex((t) => t.selected);
    return queue.slice(i + 1);
  });

  function loadQueue() {
    return api
      .queue()
      .then((q) => {
        queue = q;
        requestAnimationFrame(() => queueEl?.querySelector(".q.sel")?.scrollIntoView({ block: "center", behavior: "smooth" }));
      })
      .catch(() => (queue = []));
  }
  function loadChips() {
    return api.queueChips().then((c) => (chips = c)).catch(() => (chips = []));
  }

  // Recarrega fila/filtros quando a faixa muda (só com a aba aberta).
  const videoId = $derived(s.videoId);
  $effect(() => {
    videoId;
    player.queueVersion;
    if (tab === "queue" || tab === "upnext") loadQueue();
    if (tab === "upnext") loadChips();
  });

  /** Troca o filtro do mix (Tudo / Conhecido / Descobrir) e recarrega a fila. */
  async function selectChip(i: number, label: string) {
    if (chipBusy) return;
    chipBusy = true;
    chips = chips.map((c) => ({ ...c, selected: c.index === i }));
    playerCmd("selectQueueChip", { index: i, label });
    await new Promise((r) => setTimeout(r, 1200));
    await Promise.all([loadQueue(), loadChips()]);
    setTimeout(loadQueue, 1500); // o YT Music às vezes completa a fila em duas etapas
    chipBusy = false;
  }

  // Fundo: capa em alta resolução com crossfade ao trocar de faixa.
  const bg = new Crossfade();
  $effect(() => bg.set(thumb(s.thumb, 1200)));

  function close() {
    player.openNow(null);
  }
  function goArtist() {
    if (!s.artistId) return;
    close();
    router.go({ name: "artist", id: s.artistId });
  }
  function toggleTab(t: Exclude<NowTab, "art">) {
    player.openNow(tab === t ? "art" : t);
  }
</script>


<div class="now">
  <div class="backdrop" aria-hidden="true">
    {#each bg.layers as l (l.id)}
      <img src={l.url} alt="" decoding="async" class:in={l.id === bg.shown} onload={() => bg.loaded(l.id)} onerror={() => bg.failed(l.id)} />
    {/each}
    <div class="shade"></div>
  </div>

  <header class="top">
    <button class="icon-btn" onclick={close} title="Fechar (Esc)"><Icon name="collapse" size={22} /></button>
    <h2>Tocando agora</h2>
    <nav class="tabs">
      <button class:on={tab === "queue"} onclick={() => toggleTab("queue")} title="Fila"><Icon name="queue" size={16} /> <span>Fila</span></button>
      <button class:on={tab === "upnext"} onclick={() => toggleTab("upnext")} title="A seguir"><Icon name="upnext" size={16} /> <span>A seguir</span></button>
      <button class:on={tab === "lyrics"} onclick={() => toggleTab("lyrics")} title="Letra"><Icon name="lyrics" size={16} /> <span>Letra</span></button>
    </nav>
  </header>

  {#if tab === "queue" || tab === "upnext" || tab === "lyrics"}
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
              <button class="q" class:sel={t.selected} onclick={() => player.playQueueItem(t)} use:holdDrag={t} use:songMenu={t}>
                <div class="q-text">
                  <div class="ellipsis t">{t.title}</div>
                  <div class="ellipsis s">{t.subtitle || artistsText(t.artists)}</div>
                </div>
                <span class="d">{t.duration}</span>
              </button>
            {/each}
          {/if}
        </div>
      {:else if tab === "upnext"}
        <div class="side-head">
          <span class="section-title">A seguir</span>
          <button class="hide" onclick={() => player.openNow("art")}>Ocultar</button>
        </div>
        <div class="chips" class:busy={chipBusy}>
          {#if chips.length}
            {#each chips as c (c.index)}
              <button class="chip" class:sel={c.selected} onclick={() => selectChip(c.index, c.label)}>{c.label}</button>
            {/each}
          {:else}
            {#each DEFAULT_CHIPS as label, i}
              <button class="chip" class:sel={i === 0} disabled title="Disponível quando a fila é um mix/rádio automático">{label}</button>
            {/each}
          {/if}
        </div>
        <div class="scroll">
          {#if !upNext}
            {#each Array(8) as _}<div class="skeleton" style="height:44px;margin:6px 0"></div>{/each}
          {:else if upNext.length === 0}
            <p class="muted pad">Nada na sequência.</p>
          {:else}
            {#each upNext as t (t.index)}
              <button class="q" onclick={() => player.playQueueItem(t)} use:holdDrag={t} use:songMenu={t}>
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
        <LyricsPanel />
      {/if}
    </aside>
  {/if}

  <footer class="bottom">
    <div class="hero" use:holdDrag={current} use:songMenu={current}>
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
        <button class="pill" class:off={!player.shuffleOn} onclick={() => player.shuffle()} title={player.shuffleOn ? "Aleatório: ligado" : "Aleatório: desligado"}>
          <Icon name="shuffle" size={16} />
        </button>
        <button class="icon-btn rep" class:on={s.repeat === "ONE"} onclick={() => player.cycleRepeat()} title={s.repeat === "ONE" ? "Repetindo esta música" : "Tocando em sequência"}>
          <Icon name={s.repeat === "ONE" ? "repeat-one" : "repeat"} size={18} />
        </button>
        <span class="spacer"></span>
        <button class="icon-btn heart" class:on={s.liked} onclick={() => player.like()} title="Curtir">
          <Icon name={s.liked ? "heart-fill" : "heart"} size={18} />
        </button>
        <div class="volume">
          <button class="icon-btn" onclick={() => player.toggleMute()} title="Volume"><Icon name={volIcon} size={18} /></button>
          <div class="vol-range"><Range label="Volume" value={s.muted ? 0 : s.volume} oninput={(v) => player.setVolume(v)} /></div>
        </div>
        <button class="icon-btn dup" class:on={tab === "lyrics"} onclick={() => toggleTab("lyrics")} title="Letra"><Icon name="lyrics" size={18} /></button>
        <button class="icon-btn dup" class:on={tab === "queue"} onclick={() => toggleTab("queue")} title="Fila"><Icon name="queue" size={18} /></button>
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
  .backdrop img.in {
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
    min-width: 0;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font: 300 28px var(--font-display);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-shadow: 0 2px 16px rgba(0, 0, 0, 0.5);
  }
  .tabs {
    flex: none;
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
  .q-art {
    width: 36px;
    flex: none;
  }
  .chips {
    display: flex;
    gap: 6px;
    padding: 0 14px 10px;
    flex-wrap: wrap;
    transition: opacity 0.2s;
  }
  .chips.busy {
    opacity: 0.6;
    pointer-events: none;
  }
  .chip {
    height: 30px;
    padding: 0 14px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08) inset;
    transition: background 0.2s, color 0.2s, transform 0.35s var(--spring);
  }
  .chip:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.16);
    transform: translateY(-1px);
  }
  .chip:active:not(:disabled) {
    transform: scale(0.95);
  }
  .chip.sel {
    color: #0a0a0f;
    background: #fff;
  }
  .chip:disabled {
    opacity: 0.5;
    cursor: default;
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
    --range: var(--dyn-strong);
    --range-glow: var(--dyn-soft);
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
    flex: none;
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
    flex: none;
    width: 34px;
    height: 34px;
    margin-left: 4px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: #ffffff;
    transition: transform 0.4s var(--spring), filter 0.2s;
  }
  .pill:hover {
    transform: scale(1.1);
    filter: brightness(1.1);
  }
  .pill.off {
    background: transparent;
    color: var(--muted);
  }
  .pill.off:hover {
    color: var(--text);
    background: rgba(255, 255, 255, 0.12);
  }
  .heart.on {
    color: var(--accent);
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
  @media (max-width: 860px) {
    .tabs span {
      display: none;
    }
    /* só ícone: botão redondo de verdade */
    .tabs button {
      width: 38px;
      height: 38px;
      padding: 0;
      justify-content: center;
    }
    .half {
      width: 100%;
    }
    .side {
      left: 14px;
      right: 14px;
      width: auto;
      bottom: 236px;
    }
    .corner {
      display: none;
    }
  }
  @media (max-width: 700px) {
    h2 {
      font-size: 18px;
    }
    .top {
      padding: 12px 12px 0 8px;
    }
    .bottom {
      left: 14px;
      right: 14px;
      bottom: 12px;
    }
    .hero {
      gap: 12px;
      margin-bottom: 10px;
    }
    .art {
      width: 76px;
    }
    .side {
      top: 56px;
      left: 10px;
      right: 10px;
      bottom: 210px;
    }
    .volume {
      display: none;
    }
  }
  /* janela bem estreita (tamanho de celular) */
  @media (max-width: 520px) {
    h2 {
      font-size: 15px;
      letter-spacing: 0.04em;
    }
    .top {
      gap: 6px;
    }
    .tabs {
      gap: 2px;
    }
    .buttons {
      gap: 2px;
    }
    /* Letra e Fila já estão nas abas do topo */
    .buttons .dup {
      display: none;
    }
  }
  @media (max-width: 380px) {
    h2 {
      display: none;
    }
    .top {
      justify-content: space-between;
    }
    .buttons :global(.icon-btn) {
      width: 34px;
      height: 34px;
    }
    .play {
      width: 42px;
      height: 42px;
    }
    .pill {
      width: 32px;
      height: 32px;
    }
  }
</style>
