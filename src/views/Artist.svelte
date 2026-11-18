<script lang="ts">
  // Página de artista em 3 colunas: discografia | faixas | semelhantes + info.
  import Cover from "../components/Cover.svelte";
  import Icon from "../components/Icon.svelte";
  import Status from "../components/Status.svelte";
  import TrackList from "../components/TrackList.svelte";
  import { api } from "../lib/api";
  import { player } from "../lib/player.svelte";
  import { router } from "../lib/router.svelte";
  import type { Hint } from "../lib/router.svelte";
  import type { AlbumItem, ArtistPage } from "../lib/types";
  import { openItem } from "../lib/actions";
  import { sheen } from "../lib/fx.svelte";
  import { thumb } from "../lib/util";

  let { id, hint }: { id: string; hint?: Hint } = $props();
  let attempt = $state(0);
  const data = $derived.by(() => { attempt; return api.artist(id); });

  /** "top" = mais tocadas; senão browseId do álbum. */
  let selected = $state<string>("top");
  let bioOpen = $state(false);
  $effect(() => {
    id;
    selected = "top";
    bioOpen = false;
  });

  const discography = (a: ArtistPage): AlbumItem[] => [...a.albums, ...a.singles];
  const year = (al: AlbumItem) => al.year ?? al.subtitle?.match(/\d{4}/)?.[0] ?? "";
</script>

{#await data}
  <div class="page">
    <div class="hero glass">
      <div class="avatar" class:skeleton={!hint?.thumb} style:view-transition-name="hero-cover">
        {#if hint?.thumb}<Cover src={hint.thumb} size={240} round eager icon="user" />{/if}
      </div>
      {#if hint?.title}<h1>{hint.title}</h1>{:else}<div class="skeleton" style="height:36px;width:260px"></div>{/if}
    </div>
  </div>
{:then a}
  {@const disco = discography(a)}
  <div class="page">
    <header class="hero glass">
      <img class="banner" src={thumb(a.thumb, 120)} alt="" aria-hidden="true" />
      <div class="avatar" style:view-transition-name="hero-cover"><Cover src={a.thumb || hint?.thumb} size={240} round eager icon="user" /></div>
      <div class="who">
        <h1>{a.name}</h1>
        <div class="muted">{[a.subscribers, a.monthlyListeners].filter(Boolean).join(" • ")}</div>
        <div class="actions">
          <button class="btn primary" onclick={() => (a.playlistId ? player.playPlaylistId(a.playlistId) : a.songs[0] && player.playTrack(a.songs[0]))}>
            <Icon name="play" size={14} /> Tocar tudo
          </button>
          {#if a.radioPlaylistId}
            <button class="btn" onclick={() => player.playPlaylistId(a.radioPlaylistId!)}><Icon name="radio" size={14} /> Rádio</button>
          {/if}
        </div>
      </div>
    </header>

    <div class="cols">
      <!-- Discografia -->
      <aside class="disco">
        <div class="col-head"><span class="section-title">Discografia</span><span class="muted">{disco.length}</span></div>
        <div class="disco-list">
          <button class="disc top sheen" use:sheen class:sel={selected === "top"} onclick={() => (selected = "top")}>
            <span class="disc-title">Mais tocadas</span>
            <span class="disc-sub">{a.songs.length} músicas</span>
          </button>
          {#each disco as al (al.id)}
            <button class="disc sheen" use:sheen class:sel={selected === al.id} onclick={() => (selected = al.id)}>
              <img src={thumb(al.thumb, 226)} alt="" loading="lazy" decoding="async" />
              <span class="disc-title ellipsis">{al.title}</span>
              <span class="disc-sub">{year(al)}</span>
            </button>
          {/each}
        </div>
      </aside>

      <!-- Faixas -->
      <section class="center glass" use:sheen>
        {#if selected === "top"}
          <div class="center-head">
            <h2>Mais tocadas</h2>
            <button class="btn" onclick={() => a.songs[0] && player.playTrack(a.songs[0], a.playlistId)}><Icon name="play" size={14} /> Tocar</button>
          </div>
          {#if a.songs.length}
            <TrackList tracks={a.songs} playlistId={a.playlistId} showAlbum={false} compact />
          {:else}
            <Status title="Sem músicas" />
          {/if}
        {:else}
          <div class="strip">
            {#each disco as al (al.id)}
              <button class="strip-item" class:sel={selected === al.id} onclick={() => (selected = al.id)} title={al.title}>
                <Cover src={al.thumb} size={226} icon="album" />
              </button>
            {/each}
          </div>
          {#key selected}
            {#await api.collection(selected)}
              {#each Array(6) as _}<div class="skeleton" style="height:42px;margin:6px 0"></div>{/each}
            {:then c}
              <div class="center-head">
                <div>
                  <h2>{c.title}</h2>
                  <div class="muted small">{[c.subtitle, c.info].filter(Boolean).join(" • ")}</div>
                </div>
                <div class="row-actions">
                  <button class="btn primary" onclick={() => player.playCollection(c)}><Icon name="play" size={14} /> Tocar</button>
                  <button class="icon-btn" title="Aleatório" onclick={() => player.playCollection(c, true)}><Icon name="shuffle" size={18} /></button>
                  <button class="icon-btn" title="Abrir álbum" onclick={() => router.go({ name: "collection", id: c.id })}><Icon name="expand" size={16} /></button>
                </div>
              </div>
              <TrackList tracks={c.tracks} playlistId={c.playlistId} showArt={false} numbered showAlbum={false} compact />
            {:catch e}
              <Status title="Não foi possível carregar o álbum" message={String(e)} />
            {/await}
          {/key}
        {/if}
      </section>

      <!-- Semelhantes + info -->
      <aside class="side">
        {#if a.related.length}
          <div class="col-head"><span class="section-title">Artistas semelhantes</span></div>
          <div class="related">
            {#each a.related.slice(0, 6) as r (r.id)}
              <button class="rel" onclick={(e) => openItem(r, e.currentTarget.querySelector(".cover"))} title={r.title}>
                <Cover src={r.thumb} size={160} round icon="user" />
                <span class="ellipsis">{r.title}</span>
              </button>
            {/each}
          </div>
        {/if}

        <div class="col-head"><span class="section-title">Info</span></div>
        <div class="stats">
          <div class="stat"><b>{a.albums.length}</b><span>Álbuns</span></div>
          <div class="stat"><b>{a.singles.length}</b><span>Singles</span></div>
          <div class="stat"><b>{a.songs.length}</b><span>Populares</span></div>
        </div>
        {#if a.description}
          <p class="bio" class:open={bioOpen}>{a.description}</p>
          <button class="more" onclick={() => (bioOpen = !bioOpen)}>{bioOpen ? "Ler menos" : "Ler mais"}</button>
        {/if}
      </aside>
    </div>
  </div>
{:catch e}
  <Status icon="mic" title="Não foi possível carregar o artista" message={String(e)} action="Tentar de novo" onaction={() => attempt++} />
{/await}

<style>
  .page {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0 20px var(--player-space);
    gap: 14px;
  }
  .hero {
    position: relative;
    display: flex;
    align-items: center;
    gap: 22px;
    padding: 18px 22px;
    border-radius: var(--radius-xl);
    overflow: hidden;
    flex: none;
  }
  .hero > :not(.banner) {
    position: relative;
    z-index: 2;
  }
  .banner {
    position: absolute;
    inset: -20%;
    width: 140%;
    height: 140%;
    object-fit: cover;
    filter: blur(30px) brightness(0.5) saturate(1.4);
    opacity: 0.85;
    z-index: 0;
  }
  .avatar {
    width: 104px;
    height: 104px;
    border-radius: 50%;
    flex: none;
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.18), 0 14px 34px rgba(0, 0, 0, 0.55);
  }
  .who {
    min-width: 0;
  }
  h1 {
    margin: 0 0 4px;
    font: 800 clamp(28px, 3.6vw, 44px) / 1.05 var(--font-display);
    letter-spacing: -0.01em;
    text-transform: uppercase;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  .cols {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(220px, 300px) minmax(0, 1fr) minmax(220px, 300px);
    gap: 16px;
  }
  .col-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 4px 2px 10px;
  }
  .disco {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .disco-list {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-right: 4px;
  }
  .disc {
    position: relative;
    height: 66px;
    flex: none;
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-end;
    padding: 0 14px;
    text-align: right;
    background: rgba(255, 255, 255, 0.04);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.18) inset, 0 0 0 1px rgba(255, 255, 255, 0.07) inset;
    transition: box-shadow 0.25s, transform 0.4s var(--spring);
  }
  .disc:hover {
    transform: translateX(4px) scale(1.01);
  }
  .disc:active {
    transform: scale(0.97);
  }
  .disc.sel {
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.3) inset, 0 0 0 1.5px var(--accent) inset, 0 8px 24px -8px var(--accent-glow);
  }
  .disc img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 35%;
    filter: brightness(0.42) saturate(1.2);
    z-index: 0;
    transition: filter 0.3s, transform 0.6s var(--ease);
  }
  .disc:hover img,
  .disc.sel img {
    filter: brightness(0.58) saturate(1.35);
    transform: scale(1.06);
  }
  .disc.top {
    background: linear-gradient(120deg, rgba(43, 196, 212, 0.35), rgba(124, 58, 237, 0.3));
  }
  .disc-title,
  .disc-sub {
    position: relative;
    z-index: 1;
    max-width: 100%;
  }
  .disc-title {
    font: 700 17px var(--font-display);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  }
  .disc-sub {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.75);
  }
  .center {
    min-height: 0;
    overflow-y: auto;
    padding: 14px 16px;
  }
  .center-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 4px 4px 12px;
  }
  h2 {
    margin: 0;
    font: 700 20px var(--font-display);
  }
  .small {
    font-size: 12px;
    margin-top: 2px;
  }
  .row-actions {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .strip {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow-x: auto;
    padding: 6px 4px 14px;
    scrollbar-width: none;
  }
  .strip-item {
    width: 76px;
    flex: none;
    opacity: 0.55;
    border-radius: 10px;
    transition: width 0.5s var(--spring), opacity 0.25s, transform 0.4s var(--spring);
  }
  .strip-item:hover {
    opacity: 0.9;
    transform: translateY(-3px) rotate(-1.5deg);
  }
  .strip-item.sel {
    width: 128px;
    opacity: 1;
  }
  .strip-item :global(.cover) {
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
  }
  .side {
    min-height: 0;
    overflow-y: auto;
    padding-right: 4px;
  }
  .related {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px 10px;
    margin-bottom: 20px;
  }
  .rel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 12px;
    color: var(--muted);
    transition: transform 0.15s var(--ease), color 0.15s;
  }
  .rel span {
    max-width: 100%;
  }
  .rel:hover {
    color: var(--text);
    transform: translateY(-2px);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }
  .stat {
    padding: 12px 10px;
    border-radius: 16px;
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03));
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.22) inset, 0 0 0 1px rgba(255, 255, 255, 0.06) inset;
    display: flex;
    flex-direction: column;
    transition: transform 0.4s var(--spring);
  }
  .stat:hover {
    transform: translateY(-3px);
  }
  .stat b {
    font: 700 26px var(--font-display);
    color: var(--accent);
  }
  .stat span {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .bio {
    margin: 0;
    color: var(--muted);
    line-height: 1.55;
    font-size: 13px;
    display: -webkit-box;
    -webkit-line-clamp: 7;
    line-clamp: 7;
    -webkit-box-orient: vertical;
    overflow: hidden;
    user-select: text;
  }
  .bio.open {
    display: block;
  }
  .more {
    margin-top: 6px;
    color: var(--accent);
    font-weight: 600;
    font-size: 13px;
  }
  @media (max-width: 1240px) {
    .cols {
      grid-template-columns: minmax(200px, 260px) minmax(0, 1fr);
    }
    .side {
      display: none;
    }
  }
</style>
