<script lang="ts">
  // Navegação inferior (janela estreita / formato celular). Em telas largas as
  // abas ficam na barra superior e este componente fica oculto via CSS.
  import { sheen } from "../lib/fx.svelte";
  import { router, type Tab } from "../lib/router.svelte";
  import Icon from "./Icon.svelte";

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "home", label: "Início", icon: "home" },
    { id: "songs", label: "Músicas", icon: "note" },
    { id: "artists", label: "Artistas", icon: "mic" },
    { id: "albums", label: "Álbuns", icon: "album" },
    { id: "playlists", label: "Playlists", icon: "playlist" },
  ];
</script>

<nav class="bottom-nav glass" use:sheen>
  {#each TABS as t}
    <button class:active={router.tab === t.id} onclick={() => router.tabTo(t.id)}>
      <Icon name={t.icon} size={20} />
      <span>{t.label}</span>
    </button>
  {/each}
</nav>

<style>
  .bottom-nav {
    display: none;
  }
  @media (max-width: 700px) {
    .bottom-nav {
      position: absolute;
      z-index: 16;
      left: 10px;
      right: 10px;
      bottom: 10px;
      height: var(--bottomnav);
      display: flex;
      align-items: stretch;
      justify-content: space-around;
      padding: 4px;
      border-radius: 22px;
    }
  }
  button {
    position: relative;
    z-index: 2;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border-radius: 18px;
    font-size: 10px;
    font-weight: 600;
    color: var(--muted);
    transition: color 0.2s, background 0.25s, transform 0.35s var(--spring);
  }
  button:active {
    transform: scale(0.9);
  }
  button.active {
    color: var(--text);
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.06));
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.35) inset;
  }
  button.active :global(svg) {
    color: var(--accent);
  }
</style>
