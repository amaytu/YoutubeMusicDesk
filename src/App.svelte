<script lang="ts">
  import Background from "./components/Background.svelte";
  import BottomNav from "./components/BottomNav.svelte";
  import NowPlaying from "./components/NowPlaying.svelte";
  import PlayerBar from "./components/PlayerBar.svelte";
  import TitleBar from "./components/TitleBar.svelte";
  import Welcome from "./components/Welcome.svelte";
  import { player } from "./lib/player.svelte";
  import { router, routeKey } from "./lib/router.svelte";
  import Albums from "./views/Albums.svelte";
  import Artist from "./views/Artist.svelte";
  import Artists from "./views/Artists.svelte";
  import Collection from "./views/Collection.svelte";
  import Home from "./views/Home.svelte";
  import Playlists from "./views/Playlists.svelte";
  import Search from "./views/Search.svelte";
  import Songs from "./views/Songs.svelte";

  const r = $derived(router.current);

  // Atalhos globais (fora de campos de texto).
  function onKey(e: KeyboardEvent) {
    const typing = (e.target as HTMLElement)?.matches?.("input, select, textarea");
    if (e.altKey && e.key === "ArrowLeft") {
      e.preventDefault();
      router.back();
    } else if (typing) {
      return;
    } else if (e.code === "Space") {
      e.preventDefault();
      player.toggle();
    } else if (e.ctrlKey && e.key === "ArrowRight") {
      player.next();
    } else if (e.ctrlKey && e.key === "ArrowLeft") {
      player.prev();
    }
  }
  // Botão "voltar" do mouse.
  function onMouse(e: MouseEvent) {
    if (e.button === 3) router.back();
  }
</script>

<svelte:window onkeydown={onKey} onmouseup={onMouse} />

<!-- Refração do "liquid glass": desloca levemente o que está atrás do vidro. -->
<svg class="defs" aria-hidden="true">
  <filter id="lg-refract" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="2" seed="11" result="noise" />
    <feGaussianBlur in="noise" stdDeviation="3" result="soft" />
    <feDisplacementMap in="SourceGraphic" in2="soft" scale="30" xChannelSelector="R" yChannelSelector="G" />
  </filter>
</svg>

<div class="app">
  <Background src={player.state.thumb} />
  <TitleBar />
  <main>
    {#key routeKey(r)}
      <div class="view">
        {#if r.name === "home"}<Home />
        {:else if r.name === "songs"}<Songs />
        {:else if r.name === "albums"}<Albums />
        {:else if r.name === "artists"}<Artists />
        {:else if r.name === "playlists"}<Playlists />
        {:else if r.name === "search"}<Search q={r.q} />
        {:else if r.name === "artist"}<Artist id={r.id} hint={r} />
        {:else if r.name === "collection"}<Collection id={r.id} hint={r} />
        {/if}
      </div>
    {/key}
  </main>
  <PlayerBar />
  <BottomNav />
  {#if player.nowPlaying}<NowPlaying />{/if}
  <Welcome />
</div>

<style>
  .defs {
    position: absolute;
    width: 0;
    height: 0;
  }
  .app {
    position: relative;
    height: 100%;
    display: grid;
    grid-template-rows: var(--titlebar) minmax(0, 1fr);
    grid-template-columns: minmax(0, 1fr);
    overflow: hidden;
  }
  /* O conteúdo vai até o fim da janela e rola por baixo do player de vidro. */
  main {
    position: relative;
    z-index: 1;
    min-height: 0;
    min-width: 0;
    view-transition-name: page;
  }
  .view {
    height: 100%;
  }
</style>
