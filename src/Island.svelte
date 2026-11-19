<script lang="ts">
  // Ilha dinâmica: roda numa janela transparente, sempre no topo, centralizada
  // no alto da tela enquanto o app está minimizado/na bandeja.
  //  - compacta: capa + letra passando
  //  - mouse por cima: abre com título, letra e controles
  //  - botão direito: recolhe num traço discreto; clique de novo para voltar
  import { onMount, tick, untrack } from "svelte";
  import { backOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";
  import Cover from "./components/Cover.svelte";
  import Icon from "./components/Icon.svelte";
  import { IS_TAURI, islandHitbox, showMain } from "./lib/api";
  import type { Translation } from "./lib/api";
  import { lineAt, loadLyrics, lyricsPrefs, sameLanguage, translateSet, type LyricSet } from "./lib/lyrics.svelte";
  import { palette } from "./lib/palette.svelte";
  import { player } from "./lib/player.svelte";

  type Mode = "compact" | "open" | "tucked";
  const WIN_W = 480; // largura da janela (igual a island.rs)
  const SIZES: Record<Mode, [number, number]> = {
    compact: [360, 42], // altura cresce com o texto (até 3 linhas)
    open: [440, 146],
    tucked: [72, 10],
  };
  /** Altura real da pílula compacta (medida do texto). */
  let compactH = $state(42);
  const sizeOf = (m: Mode): [number, number] => (m === "compact" ? [SIZES.compact[0], compactH] : SIZES[m]);
  const TUCK_KEY = "ymd.island.tucked";

  let mode = $state<Mode>(localStorage.getItem(TUCK_KEY) === "1" ? "tucked" : "compact");
  let hoverTimer: ReturnType<typeof setTimeout>;
  let shrinkTimer: ReturnType<typeof setTimeout>;

  const s = $derived(player.state);
  let lyrics = $state<LyricSet | null>(null);
  const idx = $derived(lyrics ? lineAt(lyrics.lines, player.time) : -1);
  const line = $derived(lyrics && idx >= 0 ? lyrics.lines[idx].text : "");
  const nextLine = $derived(lyrics && idx + 1 < lyrics.lines.length ? lyrics.lines[idx + 1].text : "");
  /** Tradução da linha atual (se "Traduzir" estiver ligado e a letra não for PT). */
  let tr = $state<Translation | null>(null);
  const trLine = $derived(
    lyricsPrefs.translate && tr && !sameLanguage(tr) && idx >= 0 && tr.lines[idx] !== line && line !== "♪" ? tr.lines[idx] : "",
  );
  /** Texto da pílula compacta: sempre a letra original (ou título — artista). */
  const ticker = $derived(line || [s.title, s.artist].filter(Boolean).join(" — "));
  const progress = $derived(s.duration ? Math.min(100, (player.time / s.duration) * 100) : 0);

  $effect(() => {
    palette.update(player.state.thumb);
  });

  // Busca a letra só quando a faixa (ou a duração dela) muda.
  const trackKey = $derived(`${player.state.videoId}:${Math.round(player.state.duration)}`);
  $effect(() => {
    trackKey;
    const st = untrack(() => player.state);
    lyrics = null;
    loadLyrics(st).then((l) => {
      if (l && player.state.videoId === st.videoId) lyrics = l;
    });
  });

  $effect(() => {
    tr = null;
    if (!lyricsPrefs.translate || !lyrics) return;
    const current = lyrics;
    translateSet(untrack(() => player.state.videoId), current).then((t) => {
      if (lyrics === current) tr = t;
    });
  });

  // Área clicável: cresce na hora, encolhe depois da animação.
  function report(m: Mode) {
    const [w, h] = sizeOf(m);
    const send = (w: number, h: number) => islandHitbox({ x: (WIN_W - w) / 2 - 2, y: 0, w: w + 4, h: h + 4 });
    clearTimeout(shrinkTimer);
    const [cw, ch] = sizeOf(mode);
    if (w >= cw && h >= ch) send(w, h);
    else shrinkTimer = setTimeout(() => send(w, h), 420);
  }
  function setMode(m: Mode) {
    if (m === mode) return;
    report(m);
    mode = m;
  }
  onMount(() => {
    const [w, h] = sizeOf(mode);
    islandHitbox({ x: (WIN_W - w) / 2 - 2, y: 0, w: w + 4, h: h + 4 });
  });

  function enter() {
    clearTimeout(hoverTimer);
    if (mode === "tucked") return;
    hoverTimer = setTimeout(() => setMode("open"), 70);
  }
  function leave() {
    clearTimeout(hoverTimer);
    if (mode === "open") hoverTimer = setTimeout(() => setMode("compact"), 260);
  }
  function onContext(e: MouseEvent) {
    e.preventDefault();
    clearTimeout(hoverTimer);
    const tucked = mode !== "tucked";
    localStorage.setItem(TUCK_KEY, tucked ? "1" : "0");
    setMode(tucked ? "tucked" : "compact");
  }
  function onClick() {
    if (mode === "tucked") {
      localStorage.setItem(TUCK_KEY, "0");
      setMode("compact");
      tick().then(() => setMode("open"));
    }
  }

  // A pílula compacta acompanha a altura do texto (1 a 3 linhas).
  let tickerH = $state(20);
  $effect(() => {
    const h = Math.max(42, Math.ceil(tickerH) + 22);
    if (h === compactH) return;
    const grow = h > compactH;
    compactH = h;
    if (mode === "compact") {
      const [w] = SIZES.compact;
      const send = () => islandHitbox({ x: (WIN_W - w) / 2 - 2, y: 0, w: w + 4, h: h + 4 });
      clearTimeout(shrinkTimer);
      if (grow) send();
      else shrinkTimer = setTimeout(send, 420);
    }
  });
</script>

<div class="stage" class:demo={!IS_TAURI}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="pill {mode}"
    class:playing={s.playing}
    style:width="{sizeOf(mode)[0]}px"
    style:height="{sizeOf(mode)[1]}px"
    onpointerenter={enter}
    onpointerleave={leave}
    oncontextmenu={onContext}
    onclick={onClick}
    title={mode === "tucked" ? "Clique para mostrar a ilha" : ""}
  >
    {#if mode === "compact"}
      <div class="row compact-row" in:fade={{ duration: 180, delay: 120 }}>
        <div class="mini-art"><Cover src={s.thumb} size={80} eager /></div>
        <div class="ticker" bind:clientHeight={tickerH}>
          {#key ticker}
            <span class="ticker-text" in:fly={{ y: 10, duration: 380, easing: backOut }}>{ticker}</span>
          {/key}
        </div>
        <span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      </div>
    {:else if mode === "open"}
      <div class="open-body" in:fade={{ duration: 200, delay: 140 }}>
        <div class="top">
          <button class="art" onclick={() => showMain()} title="Abrir o app">
            <Cover src={s.thumb} size={120} eager />
          </button>
          <div class="meta">
            <div class="title">{s.title || "Nada tocando"}</div>
            <div class="artist">{s.artist}</div>
          </div>
          <span class="eq big" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        </div>
        <div class="lyric">
          {#key line}
            <span class="now" in:fly={{ y: 10, duration: 380, easing: backOut }} out:fade={{ duration: 120 }}>
              {line || (lyrics ? "♪" : "Letra indisponível")}
            </span>
          {/key}
          {#if trLine}<span class="next tr">{trLine}</span>{:else if nextLine}<span class="next">{nextLine}</span>{/if}
        </div>
        <div class="controls">
          <button class="ctl" onclick={(e) => (e.stopPropagation(), player.prev())} title="Anterior"><Icon name="prev" size={18} /></button>
          <button class="ctl play" onclick={(e) => (e.stopPropagation(), player.toggle())} title={s.playing ? "Pausar" : "Tocar"}>
            <Icon name={s.playing ? "pause" : "play"} size={18} />
          </button>
          <button class="ctl" onclick={(e) => (e.stopPropagation(), player.next())} title="Próxima"><Icon name="next" size={18} /></button>
        </div>
        <div class="bar"><i style:width="{progress}%"></i></div>
      </div>
    {/if}
  </div>
</div>

<style>
  :global(html.island-mode),
  :global(html.island-mode body),
  :global(html.island-mode #app) {
    background: transparent !important;
    overflow: hidden;
  }
  .stage {
    position: fixed;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }
  /* no navegador (npm run dev), um "papel de parede" para visualizar */
  .stage.demo {
    background: linear-gradient(135deg, #2c3e50, #4ca1af);
  }

  .pill {
    position: relative;
    overflow: hidden;
    color: #fff;
    background: #050507;
    border-radius: 999px;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.07) inset,
      0 1px 0 rgba(255, 255, 255, 0.1) inset,
      0 10px 28px rgba(0, 0, 0, 0.45);
    transition:
      width 0.5s cubic-bezier(0.34, 1.32, 0.5, 1),
      height 0.5s cubic-bezier(0.34, 1.32, 0.5, 1),
      border-radius 0.5s cubic-bezier(0.34, 1.32, 0.5, 1),
      opacity 0.3s,
      background 0.3s;
    cursor: default;
  }
  .pill.open {
    border-radius: 32px;
  }
  .pill.tucked {
    border-radius: 0 0 8px 8px;
    opacity: 0.45;
    cursor: pointer;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12) inset;
  }
  .pill.tucked:hover {
    opacity: 0.9;
    background: #111116;
  }

  /* ---- compacta ---- */
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 100%;
    padding: 0 14px 0 7px;
  }
  .pill.compact {
    border-radius: 22px;
  }
  .mini-art {
    width: 28px;
    flex: none;
  }
  .mini-art :global(.cover) {
    border-radius: 50%;
  }
  .playing .mini-art :global(.cover) {
    animation: spin 10s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .ticker {
    flex: 1;
    min-width: 0;
    padding: 1px 0;
  }
  .ticker-text {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font: 600 13px/18px var(--font);
    letter-spacing: 0.01em;
    text-align: center;
    overflow-wrap: anywhere;
  }

  /* equalizador: só anima enquanto toca */
  .eq {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 14px;
    flex: none;
  }
  .eq i {
    width: 3px;
    height: 4px;
    border-radius: 2px;
    background: var(--dyn-strong);
    transition: height 0.3s;
  }
  .playing .eq i {
    animation: eq 0.9s ease-in-out infinite;
  }
  .eq i:nth-child(2) {
    animation-delay: -0.25s;
  }
  .eq i:nth-child(3) {
    animation-delay: -0.5s;
  }
  .eq i:nth-child(4) {
    animation-delay: -0.7s;
  }
  .eq.big {
    height: 18px;
  }
  @keyframes eq {
    50% {
      height: 100%;
    }
  }

  /* ---- aberta ---- */
  .open-body {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px 18px 10px 12px;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .art {
    width: 50px;
    flex: none;
    border-radius: 14px;
    overflow: hidden;
    transition: transform 0.4s var(--spring);
  }
  .art:hover {
    transform: scale(1.08);
  }
  .meta {
    flex: 1;
    min-width: 0;
  }
  .title {
    font: 700 14px var(--font);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .artist {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lyric {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 34px;
    margin: 6px 0 2px;
    text-align: center;
    overflow: hidden;
  }
  .lyric .now {
    font: 700 14px/18px var(--font-display);
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lyric .next {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lyric .next.tr {
    color: var(--dyn);
    font-size: 12px;
    font-weight: 600;
  }
  .controls {
    display: flex;
    justify-content: center;
    gap: 18px;
    align-items: center;
  }
  .ctl {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: rgba(255, 255, 255, 0.85);
    transition: transform 0.35s var(--spring), background 0.2s;
  }
  .ctl:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: scale(1.12);
  }
  .ctl:active {
    transform: scale(0.88);
  }
  .ctl.play {
    width: 38px;
    height: 38px;
    color: #050507;
    background: #fff;
  }
  .ctl.play:hover {
    background: #fff;
  }
  .bar {
    position: absolute;
    left: 24px;
    right: 24px;
    bottom: 5px;
    height: 2px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.12);
    overflow: hidden;
  }
  .bar i {
    display: block;
    height: 100%;
    background: var(--dyn-strong);
    transition: width 0.25s linear;
  }
</style>
