<script lang="ts">
  import { onMount } from "svelte";
  import { IS_TAURI, win } from "../lib/api";
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

  onMount(() => {
    const off = win.onResized((m) => (maximized = m));
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key.toLowerCase() === "f") || (e.key === "/" && !isTyping(e))) {
        e.preventDefault();
        searchEl.focus();
        searchEl.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      off?.then((f) => f?.());
    };
  });

  const isTyping = (e: KeyboardEvent) => (e.target as HTMLElement)?.tagName === "INPUT";

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

  <nav class="tabs" data-tauri-drag-region>
    {#each TABS as t}
      <button class="tab" class:active={router.tab === t.id} onclick={() => router.tabTo(t.id)}>
        <Icon name={t.icon} size={16} />
        <span>{t.label}</span>
      </button>
    {/each}
  </nav>

  <div class="right" data-tauri-drag-region>
    <form class="search" onsubmit={submit}>
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
      <button class="icon-btn" title="Conta" onclick={() => (menuOpen = !menuOpen)}>
        <Icon name="user" size={18} />
      </button>
      {#if menuOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="scrim" onclick={() => (menuOpen = false)}></div>
        <div class="menu glass">
          {#if player.signedIn}
            <button onclick={() => ((menuOpen = false), player.login())}><Icon name="user" size={16} /> Trocar de conta</button>
            <button onclick={() => ((menuOpen = false), player.logout())}><Icon name="logout" size={16} /> Sair da conta</button>
          {:else}
            <button onclick={() => ((menuOpen = false), player.login())}><Icon name="google" size={16} /> Entrar com Google</button>
          {/if}
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
    z-index: 20;
    height: var(--titlebar);
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding-left: 8px;
  }
  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 100%;
  }
  .right {
    justify-content: flex-end;
  }
  .back:disabled {
    opacity: 0.3;
    pointer-events: none;
  }
  .brand {
    font-size: 12px;
    color: var(--muted);
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .tabs {
    display: flex;
    gap: 2px;
    height: 100%;
    align-items: center;
  }
  .tab {
    position: relative;
    display: flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    color: var(--muted);
    font-weight: 500;
    transition: color 0.15s, background 0.15s;
  }
  .tab:hover {
    color: var(--text);
    background: var(--panel-hover);
  }
  .tab.active {
    color: var(--text);
  }
  .tab.active::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: -1px;
    width: 18px;
    height: 3px;
    margin-left: -9px;
    border-radius: 3px;
    background: var(--accent);
    animation: grow 0.25s var(--ease);
  }
  @keyframes grow {
    from {
      transform: scaleX(0);
    }
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    width: clamp(140px, 18vw, 260px);
    padding: 0 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid var(--line);
    color: var(--muted);
    transition: border-color 0.15s, background 0.15s;
  }
  .search:focus-within {
    border-color: rgba(43, 196, 212, 0.6);
    background: rgba(255, 255, 255, 0.1);
  }
  .search input {
    flex: 1;
    min-width: 0;
    background: none;
    border: 0;
    outline: 0;
    user-select: text;
  }
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
    top: 42px;
    z-index: 2;
    min-width: 200px;
    padding: 6px;
    background: var(--panel-strong);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
    animation: pop 0.16s var(--ease);
  }
  .menu button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 10px;
    border-radius: 8px;
    text-align: left;
  }
  .menu button:hover {
    background: var(--panel-hover);
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
  }
  .win {
    display: flex;
    height: 100%;
    margin-left: 4px;
  }
  .win button {
    width: 46px;
    height: 100%;
    display: grid;
    place-items: center;
    color: var(--muted);
    transition: background 0.1s, color 0.1s;
  }
  .win button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text);
  }
  .win .close:hover {
    background: #c42b1c;
    color: #fff;
  }
  @media (max-width: 1080px) {
    .tab span,
    .brand {
      display: none;
    }
  }
</style>
