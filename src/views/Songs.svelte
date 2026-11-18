<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import Status from "../components/Status.svelte";
  import TrackList from "../components/TrackList.svelte";
  import { api } from "../lib/api";
  import { player } from "../lib/player.svelte";
  import type { Track } from "../lib/types";
  import { artistsText, keepScroll, parseDuration, plural, fmtTime } from "../lib/util";

  let attempt = $state(0);
  let filter = $state("");
  let sort = $state<"default" | "title" | "artist" | "album">("default");
  const data = $derived.by(() => { attempt; player.authVersion; return api.librarySongs(); });

  function view(items: Track[]) {
    const f = filter.trim().toLowerCase();
    let out = f
      ? items.filter((t) => `${t.title} ${artistsText(t.artists)} ${t.album?.name ?? ""}`.toLowerCase().includes(f))
      : items;
    const key = {
      default: null,
      title: (t: Track) => t.title,
      artist: (t: Track) => artistsText(t.artists, t.subtitle),
      album: (t: Track) => t.album?.name ?? "",
    }[sort];
    if (key) out = [...out].sort((a, b) => key(a).localeCompare(key(b), "pt-BR", { sensitivity: "base" }));
    return out;
  }
  const total = (items: Track[]) => fmtTime(items.reduce((s, t) => s + parseDuration(t.duration), 0));
</script>

<div class="page">
  <div class="toolbar">
    <h1>Músicas</h1>
    {#await data then items}<span class="count">{plural(items.length, "música", "músicas")} • {total(items)}</span>{/await}
    <span class="grow"></span>
    <button class="btn" onclick={() => player.playPlaylistId("LM", true)}><Icon name="shuffle" size={14} /> Curtidas aleatórias</button>
    <label class="field">
      <Icon name="filter" size={15} />
      <input bind:value={filter} placeholder="Filtrar" spellcheck="false" />
    </label>
    <label class="field">
      <Icon name="sort" size={15} />
      <select bind:value={sort}>
        <option value="default">Recentes</option>
        <option value="title">Título</option>
        <option value="artist">Artista</option>
        <option value="album">Álbum</option>
      </select>
    </label>
  </div>

  <div class="head-row">
    <span></span><span>Título</span><span>Artista</span><span>Álbum</span><span class="r">Duração</span>
  </div>

  <div class="scroll" use:keepScroll={"songs"}>
    {#await data}
      {#each Array(12) as _}<div class="skeleton" style="height:46px;margin:6px 0"></div>{/each}
    {:then items}
      {#if player.signedIn === false && items.length === 0}
        <Status icon="user" title="Entre para ver suas músicas" action="Entrar com Google" onaction={() => player.login()} />
      {:else if items.length === 0}
        <Status icon="note" title="Nenhuma música na biblioteca" message="Adicione músicas à biblioteca no YouTube Music." />
      {:else}
        <TrackList tracks={view(items)} />
      {/if}
    {:catch e}
      <Status title="Não foi possível carregar" message={String(e)} action="Tentar de novo" onaction={() => attempt++} />
    {/await}
  </div>
</div>

<style>
  .page {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0 24px;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0 14px;
  }
  h1 {
    margin: 0;
    font: 700 26px var(--font-display);
  }
  .count {
    color: var(--muted);
    font-size: 13px;
    padding-top: 4px;
  }
  .grow {
    flex: 1;
  }
  .field {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--line);
    color: var(--muted);
  }
  .field input,
  .field select {
    background: none;
    border: 0;
    outline: 0;
    color: var(--text);
  }
  .field input {
    width: 140px;
  }
  .field option {
    background: #1a1a22;
  }
  .head-row {
    display: grid;
    grid-template-columns: 44px minmax(0, 2.2fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 56px;
    gap: 14px;
    padding: 0 12px 8px 8px;
    border-bottom: 1px solid var(--line);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .r {
    text-align: right;
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0 24px;
  }
  @media (max-width: 1100px) {
    .head-row {
      grid-template-columns: 44px minmax(0, 2fr) minmax(0, 1.2fr) 56px;
    }
    .head-row span:nth-child(4) {
      display: none;
    }
  }
</style>
