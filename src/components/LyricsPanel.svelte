<script lang="ts">
  // Letra que acompanha a música: a linha atual fica em destaque e a rolagem
  // segue sozinha. Rolou com o mouse? Pausa o acompanhamento por alguns segundos
  // (ou até clicar em "Seguir a música"). Clique numa linha para pular até ela.
  // Opcional: tradução para português embaixo de cada linha.
  import { untrack } from "svelte";
  import type { Translation } from "../lib/api";
  import { lineAt, loadLyrics, lyricsPrefs, sameLanguage, translateSet, type LyricSet } from "../lib/lyrics.svelte";
  import { player } from "../lib/player.svelte";
  import Icon from "./Icon.svelte";

  const s = $derived(player.state);

  let set = $state<LyricSet | null | undefined>(undefined);
  let tr = $state<Translation | null | undefined>(undefined);
  let box = $state<HTMLDivElement>();
  let following = $state(true);
  let resumeTimer: ReturnType<typeof setTimeout>;

  const idx = $derived(set ? lineAt(set.lines, player.time) : -1);
  const showTr = $derived(lyricsPrefs.translate && !!tr && !sameLanguage(tr));

  // Carrega a letra só quando a faixa (ou a duração dela) muda — não a cada
  // atualização de tempo do player.
  const trackKey = $derived(`${player.state.videoId}:${Math.round(player.state.duration)}`);
  $effect(() => {
    trackKey;
    const st = untrack(() => player.state);
    set = undefined;
    tr = undefined;
    following = true;
    loadLyrics(st).then((l) => {
      if (player.state.videoId === st.videoId) set = l;
    });
  });

  // Tradução sob demanda.
  $effect(() => {
    if (!lyricsPrefs.translate || !set) return;
    const vid = untrack(() => player.state.videoId);
    const current = set;
    tr = undefined;
    translateSet(vid, current).then((t) => {
      if (set === current) tr = t;
    });
  });

  // Mantém a linha atual centralizada.
  $effect(() => {
    const i = idx;
    showTr;
    if (!following || !box || i < 0) return;
    const el = box.querySelector<HTMLElement>(`[data-i="${i}"]`);
    if (!el) return;
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2, behavior: "smooth" });
  });

  // Rolagem manual pausa o acompanhamento.
  function userScrolled() {
    following = false;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => (following = true), 6000);
  }
  function follow() {
    clearTimeout(resumeTimer);
    following = true;
  }
  function seekTo(i: number) {
    if (!set) return;
    player.seek(Math.max(0, set.lines[i].t - 0.1));
    follow();
  }
</script>

<div class="panel">
  <div class="head">
    <span class="section-title">Letra</span>
    {#if set}
      <span
        class="badge"
        class:synced={set.synced}
        title={set.synced
          ? `Sincronizada (${set.source === "youtube" ? "YouTube Music" : "LRCLIB"})`
          : "Não há versão sincronizada desta letra: as linhas são distribuídas ao longo da música, então o tempo é só aproximado."}
      >
        {set.synced ? "Sincronizada" : "Aproximada"}
      </span>
    {/if}
    <span class="grow"></span>
    <button class="tr-toggle" class:on={lyricsPrefs.translate} onclick={() => lyricsPrefs.toggleTranslate()} role="switch" aria-checked={lyricsPrefs.translate}>
      <Icon name="translate" size={15} />
      <span>Traduzir</span>
      <span class="switch"><i></i></span>
    </button>
  </div>

  {#if lyricsPrefs.translate && set && tr === undefined}
    <div class="note">Traduzindo…</div>
  {:else if lyricsPrefs.translate && tr === null && set}
    <div class="note err">Não foi possível traduzir agora.</div>
  {:else if lyricsPrefs.translate && sameLanguage(tr)}
    <div class="note">A letra já está em português.</div>
  {/if}

  <div class="scroll" bind:this={box} onwheel={userScrolled}>
    {#if set === undefined}
      {#each Array(10) as _, i}<div class="skeleton" style="height:20px;margin:16px auto;width:{45 + ((i * 37) % 45)}%"></div>{/each}
    {:else if set === null}
      <p class="empty">Letra não disponível para esta música.</p>
    {:else}
      <div class="pad-top"></div>
      {#each set.lines as l, i (i)}
        <button
          class="ln"
          class:cur={i === idx}
          class:past={i < idx}
          class:gap={l.text === "♪"}
          data-i={i}
          onclick={() => seekTo(i)}
          title={set.synced ? "Ir para este trecho" : ""}
        >
          <span class="o">{l.text}</span>
          {#if showTr && tr && tr.lines[i] && tr.lines[i] !== l.text && l.text !== "♪"}
            <span class="t">{tr.lines[i]}</span>
          {/if}
        </button>
      {/each}
      <div class="pad-bottom"></div>
    {/if}
  </div>

  {#if !following && set}
    <button class="btn follow" onclick={follow}><Icon name="lyrics" size={14} /> Seguir a música</button>
  {/if}
</div>

<style>
  .panel {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px 6px;
  }
  .grow {
    flex: 1;
  }
  .badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 999px;
    color: var(--muted);
    background: rgba(255, 255, 255, 0.08);
  }
  .badge.synced {
    color: var(--dyn);
    background: var(--dyn-soft);
  }
  .tr-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 6px 5px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    background: rgba(255, 255, 255, 0.06);
    transition: color 0.2s, background 0.2s;
  }
  .tr-toggle:hover {
    color: var(--text);
    background: rgba(255, 255, 255, 0.1);
  }
  .tr-toggle.on {
    color: var(--text);
  }
  .switch {
    width: 30px;
    height: 17px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
    position: relative;
    transition: background 0.25s;
  }
  .switch i {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.35s var(--spring);
  }
  .on .switch {
    background: var(--accent);
  }
  .on .switch i {
    transform: translateX(13px);
  }
  .note {
    margin: 0 16px 4px;
    font-size: 12px;
    color: var(--muted);
  }
  .note.err {
    color: #ff8a9a;
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0 14px;
    mask-image: linear-gradient(180deg, transparent, #000 14%, #000 86%, transparent);
  }
  .pad-top,
  .pad-bottom {
    height: 38%;
  }
  .ln {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    width: 100%;
    padding: 8px 10px;
    border-radius: 14px;
    text-align: center;
    color: rgba(255, 255, 255, 0.38);
    transform-origin: center;
    transition:
      color 0.35s,
      transform 0.45s var(--spring),
      opacity 0.35s,
      background 0.2s,
      filter 0.35s;
    filter: blur(0.4px);
  }
  .ln:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
  }
  .ln.past {
    color: rgba(255, 255, 255, 0.28);
  }
  .ln.cur {
    color: #fff;
    transform: scale(1.06);
    filter: none;
    text-shadow: 0 0 22px rgba(255, 255, 255, 0.25);
  }
  .ln.gap .o {
    font-size: 16px;
  }
  .o {
    font: 700 19px/1.35 var(--font-display);
    user-select: text;
  }
  .t {
    font: 600 14px/1.35 var(--font);
    color: var(--dyn);
    opacity: 0.72;
    user-select: text;
  }
  .ln.cur .t {
    opacity: 1;
    text-shadow: 0 1px 10px rgba(0, 0, 0, 0.55);
  }
  .empty {
    padding: 20px 16px;
    color: var(--muted);
    text-align: center;
  }
  .follow {
    position: absolute;
    left: 50%;
    bottom: 14px;
    transform: translateX(-50%);
    animation: rise 0.4s var(--spring);
  }
  .follow:hover {
    transform: translateX(-50%) scale(1.04);
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, 10px);
    }
  }
</style>
