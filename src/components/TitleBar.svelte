<script lang="ts">
  import { onMount, tick } from "svelte";
  import { IS_TAURI, win } from "../lib/api";
  import { appearance, sheen } from "../lib/fx.svelte";
  import { player } from "../lib/player.svelte";
  import { router, type Tab } from "../lib/router.svelte";
  import Icon from "./Icon.svelte";

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "home", label: "Início", icon: "home" },
    { id: "songs", label: "Músicas", icon: "note" },
    { id: "artists", label: "Artistas", icon: "mic" },
    { id: "albums", label: "Álbuns", icon: "album" },
    { id: "playlists", label: "Playlists", icon: "playlist" },
  ];

  let query = $state("");
  let maximized = $state(false);
  let searchEl: HTMLInputElement;
  let menuOpen = $state(false);

  // Indicador "líquido" que desliza (e estica) até a aba ativa.
  let pill = $state<HTMLElement>();
  let ind = $state({ x: 0, w: 0, ready: false });
  let stretching = $state(false);

  async function measure() {
    await tick();
    const el = pill?.querySelector<HTMLElement>(`[data-tab="${router.tab}"]`);
    if (!el) return;
    const moved = ind.ready && Math.abs(el.offsetLeft - ind.x) > 4;
    ind = { x: el.offsetLeft, w: el.offsetWidth, ready: true };
    if (moved) {
      stretching = false;
      requestAnimationFrame(() => (stretching = true));
    }
  }
  $effect(() => {
    router.tab;
    measure();
  });

  onMount(() => {
    const off = win.onResized((m) => (maximized = m));
    const ro = new ResizeObserver(() => measure());
    if (pill) ro.observe(pill);
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === "INPUT";
      if ((e.ctrlKey && e.key.toLowerCase() === "f") || (e.key === "/" && !typing)) {
        e.preventDefault();
        searchEl.focus();
        searchEl.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
      off?.then((f) => f?.());
    };
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) router.go({ name: "search", q });
  }
</script>

<header class="bar" data-tauri-drag-region>
  <div class="left" data-tauri-drag-region>
    <button class="icon-btn back" disabled={!router.canGoBack} onclick={() => router.back()} title="Voltar (Alt+←)">
      <Icon name="back" size={18} />
    </button>
    <span class="brand" data-tauri-drag-region>YouTube Music Desk</span>
  </div>

  <nav class="tabs glass" bind:this={pill} use:sheen>
    <span
      class="indicator"
      class:ready={ind.ready}
      class:stretch={stretching}
      style:--x="{ind.x}px"
      style:--w="{ind.w}px"
      onanimationend={() => (stretching = false)}
    ></span>
    {#each TABS as t}
      <button class="tab" class:active={router.tab === t.id} data-tab={t.id} onclick={() => router.tabTo(t.id)}>
        <Icon name={t.icon} size={16} />
        <span>{t.label}</span>
      </button>
    {/each}
  </nav>

  <div class="right" data-tauri-drag-region>
    <form class="search glass" onsubmit={submit} use:sheen>
      <Icon name="search" size={16} />
      <input
        bind:this={searchEl}
        bind:value={query}
        placeholder="Buscar"
        spellcheck="false"
        onkeydown={(e) => e.key === "Escape" && ((query = ""), searchEl.blur())}
      />
    </form>

    <div class="account">
      <button class="icon-btn" title="Conta e aparência" onclick={() => (menuOpen = !menuOpen)}>
        <Icon name="user" size={18} />
      </button>
      {#if menuOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="scrim" onclick={() => (menuOpen = false)}></div>
        <div class="menu glass" use:sheen>
          {#if player.signedIn}
            <button onclick={() => ((menuOpen = false), player.login())}><Icon name="user" size={16} /> Trocar de conta</button>
            <button onclick={() => ((menuOpen = false), player.logout())}><Icon name="logout" size={16} /> Sair da conta</button>
          {:else}
            <button onclick={() => ((menuOpen = false), player.login())}><Icon name="google" size={16} /> Entrar com Google</button>
          {/if}
          <hr />
          <button class="toggle" onclick={() => appearance.toggleGlass()} role="switch" aria-checked={appearance.glass}>
            <Icon name="sparkle" size={16} />
            <span>Efeitos de vidro</span>
            <span class="switch" class:on={appearance.glass}><i></i></span>
          </button>
        </div>
      {/if}
    </div>

    {#if IS_TAURI}
      <div class="win">
        <button onclick={() => win.minimize()} title="Minimizar"><Icon name="min" size={16} /></button>
        <button onclick={() => win.toggleMaximize()} title={maximized ? "Restaurar" : "Maximizar"}>
          <Icon name={maximized ? "restore" : "max"} size={14} />
        </button>
        <button class="close" onclick={() => win.close()} title="Fechar"><Icon name="close" size={16} /></button>
      </div>
    {/if}
  </div>
</header>

<style>
  .bar {
    position: relative;
    /* acima do "Tocando agora" (30): o menu da conta abre por cima dele */
    z-index: 40;
    height: var(--titlebar);
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding-left: 10px;
  }
  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 100%;
  }
  .right {
    justify-content: flex-end;
  }
  .back:disabled {
    opacity: 0.25;
    pointer-events: none;
  }
  .brand {
    font-size: 12px;
    color: var(--faint);
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  /* ---- abas em cápsula de vidro ---- */
  .tabs {
    display: flex;
    gap: 2px;
    padding: 4px;
    border-radius: 999px;
    --sheen-size: 160px;
  }
  .indicator {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 0;
    width: var(--w);
    transform: translateX(var(--x));
    border-radius: 999px;
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0.08));
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.5) inset, 0 -1px 0 rgba(255, 255, 255, 0.08) inset,
      0 4px 14px rgba(0, 0, 0, 0.25);
    opacity: 0;
    z-index: 0;
  }
  .indicator.ready {
    opacity: 1;
    transition:
      transform 0.5s var(--spring),
      width 0.5s var(--spring);
  }
  /* "gota" que estica e volta ao mudar de aba */
  .indicator.stretch {
    animation: blob 0.5s var(--ease);
  }
  @keyframes blob {
    35% {
      scale: 1.12 0.82;
    }
    70% {
      scale: 0.97 1.05;
    }
  }
  .tab {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    padding: 0 16px;
    border-radius: 999px;
    color: var(--muted);
    font-weight: 500;
    transition: color 0.25s;
  }
  .tab :global(svg) {
    transition: transform 0.4s var(--spring);
  }
  .tab:hover {
    color: var(--text);
  }
  .tab:hover :global(svg) {
    transform: translateY(-1px) scale(1.15);
  }
  .tab:active :global(svg) {
    transform: scale(0.85);
  }
  .tab.active {
    color: var(--text);
  }

  /* ---- busca ---- */
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    width: clamp(150px, 18vw, 270px);
    padding: 0 14px;
    border-radius: 999px;
    color: var(--muted);
    transition: width 0.45s var(--spring), box-shadow 0.25s;
    --sheen-size: 140px;
  }
  .search:focus-within {
    width: clamp(200px, 24vw, 340px);
    box-shadow: var(--glass-shadow), 0 0 0 1px rgba(255, 45, 70, 0.55) inset, 0 0 0 4px rgba(255, 45, 70, 0.12);
  }
  .search input {
    position: relative;
    z-index: 2;
    flex: 1;
    min-width: 0;
    background: none;
    border: 0;
    outline: 0;
    user-select: text;
  }
  .search :global(svg) {
    position: relative;
    z-index: 2;
  }

  /* ---- menu ---- */
  .account {
    position: relative;
  }
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 1;
  }
  .menu {
    position: absolute;
    right: 0;
    top: 46px;
    z-index: 2;
    min-width: 230px;
    padding: 6px;
    transform-origin: top right;
    animation: pop 0.35s var(--spring);
  }
  .menu button {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border-radius: 12px;
    text-align: left;
    transition: background 0.15s;
  }
  .menu button:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  .menu hr {
    position: relative;
    z-index: 2;
    border: 0;
    height: 1px;
    background: var(--line);
    margin: 4px 8px;
  }
  .toggle span:nth-child(2) {
    flex: 1;
  }
  .switch {
    width: 36px;
    height: 20px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
    position: relative;
    transition: background 0.25s;
  }
  .switch i {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transition: transform 0.35s var(--spring);
  }
  .switch.on {
    background: var(--accent);
  }
  .switch.on i {
    transform: translateX(16px);
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(-6px) scale(0.92);
    }
  }

  /* ---- botões da janela ---- */
  .win {
    display: flex;
    height: 100%;
    margin-left: 2px;
  }
  .win button {
    width: 46px;
    height: 100%;
    display: grid;
    place-items: center;
    color: var(--muted);
    transition: background 0.12s, color 0.12s;
  }
  .win button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text);
  }
  .win .close:hover {
    background: #c42b1c;
    color: #fff;
  }
  @media (max-width: 1100px) {
    .tab span,
    .brand {
      display: none;
    }
    .tab {
      padding: 0 12px;
    }
  }
  /* celular: abas vão para a barra inferior (BottomNav) */
  @media (max-width: 700px) {
    .bar {
      grid-template-columns: auto 1fr;
      padding-left: 6px;
    }
    .tabs {
      display: none;
    }
    .search {
      width: auto;
      flex: 1;
      min-width: 0;
      height: 34px;
    }
    .search:focus-within {
      width: auto;
    }
    .right {
      min-width: 0;
      gap: 4px;
    }
    .win button {
      width: 40px;
    }
  }
</style>
