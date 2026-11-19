<script lang="ts">
  // Detalhe de álbum/playlist. layout="panel" (lateral, como nas telas de
  // biblioteca) ou "page" (tela cheia, ao abrir pela busca/início).
  import { api } from "../lib/api";
  import { player } from "../lib/player.svelte";
  import { playlists } from "../lib/playlists.svelte";
  import { router } from "../lib/router.svelte";
  import type { Hint } from "../lib/router.svelte";
  import type { Collection } from "../lib/types";
  import Cover from "./Cover.svelte";
  import Icon from "./Icon.svelte";
  import Status from "./Status.svelte";
  import TrackList from "./TrackList.svelte";

  let {
    id,
    layout = "page",
    hint,
    onclose,
  }: { id: string; layout?: "page" | "panel"; hint?: Hint; onclose?: () => void } = $props();

  let attempt = $state(0);
  // Recarrega se esta playlist foi alterada (música adicionada/removida).
  const edited = $derived(playlists.edits[id.replace(/^VL/, "")] ?? 0);
  const data = $derived.by(() => { attempt; edited; return api.collection(id); });
  const isAlbum = $derived(id.startsWith("MPRE"));
</script>

<div class="wrap {layout}">
  {#await data}
    <!-- Enquanto carrega, a capa/título da tela anterior já aparecem (e a capa "voa" até aqui). -->
    <div class="head">
      <div class="art" class:skeleton={!hint?.thumb} style:view-transition-name={layout === "page" ? "hero-cover" : undefined}>
        {#if hint?.thumb}<Cover src={hint.thumb} size={layout === "page" ? 544 : 400} eager />{/if}
      </div>
      <div class="meta">
        {#if hint?.title}<h1>{hint.title}</h1>{:else}<div class="skeleton" style="height:28px;width:60%"></div>{/if}
        <div class="skeleton" style="height:16px;width:40%;margin-top:10px"></div>
      </div>
    </div>
    {#each Array(8) as _}<div class="skeleton" style="height:44px;margin:6px 0"></div>{/each}
  {:then c}
    {@render body(c)}
  {:catch e}
    <Status icon="album" title="Não foi possível carregar" message={String(e)} action="Tentar de novo" onaction={() => attempt++} />
  {/await}
</div>

{#snippet body(c: Collection)}
  {#if layout === "panel" && onclose}
    <button class="icon-btn close" onclick={onclose} aria-label="Fechar"><Icon name="close" size={18} /></button>
  {/if}
  <div class="head">
    <div class="art" style:view-transition-name={layout === "page" ? "hero-cover" : undefined}>
      <Cover src={c.thumb || hint?.thumb} size={layout === "page" ? 544 : 400} eager icon={isAlbum ? "album" : "playlist"} />
    </div>
    <div class="meta">
      <span class="kind">{c.subtitle || (isAlbum ? "Álbum" : "Playlist")}</span>
      <h1>{c.title}</h1>
      {#if c.artists.length}
        <div class="artists">
          {#each c.artists as a, i}
            {#if i > 0}<span>, </span>{/if}
            {#if a.id}<button class="link" onclick={() => router.go({ name: "artist", id: a.id! })}>{a.name}</button>{:else}{a.name}{/if}
          {/each}
        </div>
      {/if}
      {#if c.info}<div class="info">{c.info}</div>{/if}
      <div class="actions">
        <button class="btn primary" onclick={() => player.playCollection(c)}><Icon name="play" size={14} /> Tocar</button>
        <button class="btn" onclick={() => player.playCollection(c, true)}><Icon name="shuffle" size={14} /> Aleatório</button>
        {#if layout === "panel"}
          <button class="icon-btn" title="Abrir página" onclick={() => router.go({ name: "collection", id: c.id })}><Icon name="expand" size={16} /></button>
        {/if}
      </div>
      {#if c.description && layout === "page"}<p class="desc">{c.description}</p>{/if}
    </div>
  </div>
  {#if c.tracks.length}
    <TrackList tracks={c.tracks} playlistId={c.playlistId} showArt={!isAlbum} numbered={isAlbum} showAlbum={!isAlbum && layout === "page"} compact={layout === "panel"} />
  {:else}
    <Status icon="note" title="Sem músicas" />
  {/if}
{/snippet}

<style>
  .wrap {
    position: relative;
  }
  .panel {
    animation: enter 0.4s var(--spring);
  }
  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.98);
    }
  }
  .close {
    position: absolute;
    right: 0;
    top: 0;
    z-index: 1;
  }
  .head {
    display: flex;
    gap: 24px;
    align-items: flex-end;
    margin-bottom: 20px;
  }
  .page .art {
    width: 232px;
    flex: none;
    aspect-ratio: 1;
  }
  .art {
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 24px 50px -10px rgba(0, 0, 0, 0.6);
  }
  .art :global(.cover) {
    border-radius: 16px;
  }
  .meta {
    min-width: 0;
    flex: 1;
  }
  .kind {
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  h1 {
    margin: 6px 0 6px;
    font: 700 clamp(26px, 3.4vw, 44px) / 1.1 var(--font-display);
    letter-spacing: -0.02em;
  }
  .artists {
    font-weight: 600;
  }
  .info {
    color: var(--muted);
    font-size: 13px;
    margin-top: 4px;
  }
  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 16px;
  }
  .desc {
    margin: 14px 0 0;
    color: var(--muted);
    max-width: 680px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  @media (max-width: 700px) {
    .page .head {
      flex-direction: column;
      align-items: flex-start;
      gap: 14px;
    }
    .page .art {
      width: min(200px, 60vw);
    }
    .actions {
      flex-wrap: wrap;
    }
  }

  /* Painel lateral: capa centralizada em cima. */
  .panel .head {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 14px;
  }
  .panel .art {
    width: min(220px, 70%);
    aspect-ratio: 1;
  }
  .panel h1 {
    font-size: 22px;
  }
  .panel .actions {
    justify-content: center;
  }
</style>
