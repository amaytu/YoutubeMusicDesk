<script lang="ts">
  // Grade da biblioteca com painel lateral de faixas (álbuns e playlists).
  import { openItem } from "../lib/actions";
  import { sheen } from "../lib/fx.svelte";
  import { player } from "../lib/player.svelte";
  import type { AlbumItem, Item, PlaylistItem } from "../lib/types";
  import { keepScroll, plural } from "../lib/util";
  import Card from "./Card.svelte";
  import CollectionView from "./CollectionView.svelte";
  import Icon from "./Icon.svelte";
  import Status from "./Status.svelte";

  type Entry = AlbumItem | PlaylistItem;
  let {
    title,
    load,
    noun,
    sorts,
  }: {
    title: string;
    load: () => Promise<Entry[]>;
    noun: [string, string];
    sorts: { id: string; label: string; cmp: (a: Entry, b: Entry) => number }[];
  } = $props();

  let attempt = $state(0);
  let filter = $state("");
  let sortId = $state("default");
  let selected = $state<string | null>(null);

  const data = $derived.by(() => { attempt; player.authVersion; return load(); });

  function view(items: Entry[]) {
    const f = filter.trim().toLowerCase();
    let out = f ? items.filter((i) => (i.title + " " + (i.subtitle ?? "")).toLowerCase().includes(f)) : items;
    const s = sorts.find((x) => x.id === sortId);
    if (s) out = [...out].sort(s.cmp);
    return out;
  }

  function select(item: Item, coverEl?: HTMLElement) {
    // Janela estreita: abre a página; larga: painel ao lado.
    if (window.innerWidth < 1100) return openItem(item, coverEl);
    const id = (item as Entry).id;
    selected = selected === id ? null : id;
  }
</script>

<div class="lib" class:with-panel={!!selected}>
  <div class="main">
    <div class="toolbar">
      <h1>{title}</h1>
      {#await data then items}<span class="count">{plural(items.length, noun[0], noun[1])}</span>{/await}
      <span class="grow"></span>
      <label class="field">
        <Icon name="filter" size={15} />
        <input bind:value={filter} placeholder="Filtrar" spellcheck="false" />
      </label>
      <label class="field">
        <Icon name="sort" size={15} />
        <select bind:value={sortId}>
          <option value="default">Recentes</option>
          {#each sorts as s}<option value={s.id}>{s.label}</option>{/each}
        </select>
      </label>
    </div>

    <div class="scroll" use:keepScroll={title}>
      {#await data}
        <div class="grid">
          {#each Array(12) as _}<div><div class="skeleton" style="aspect-ratio:1"></div><div class="skeleton" style="height:14px;margin-top:10px;width:70%"></div></div>{/each}
        </div>
      {:then items}
        {#if player.signedIn === false && items.length === 0}
          <Status icon="user" title="Entre para ver sua biblioteca" message="Suas músicas, álbuns e playlists aparecem aqui depois do login." action="Entrar com Google" onaction={() => player.login()} />
        {:else if items.length === 0}
          <Status icon="album" title="Nada por aqui ainda" message="Salve álbuns e playlists no YouTube Music para vê-los aqui." />
        {:else}
          {@const list = view(items)}
          <div class="grid">
            {#each list as it (it.id)}
              <Card item={it} selected={selected === it.id} onselect={select} />
            {/each}
          </div>
          {#if list.length === 0}<p class="muted none">Nenhum resultado para “{filter}”.</p>{/if}
        {/if}
      {:catch e}
        <Status title="Não foi possível carregar" message={String(e)} action="Tentar de novo" onaction={() => attempt++} />
      {/await}
    </div>
  </div>

  {#if selected}
    <aside class="panel glass" use:sheen>
      {#key selected}
        <CollectionView id={selected} layout="panel" onclose={() => (selected = null)} />
      {/key}
    </aside>
  {/if}
</div>

<style>
  .lib {
    height: 100%;
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 0 20px 0 24px;
  }
  .lib.with-panel {
    grid-template-columns: 1fr minmax(340px, 30%);
  }
  .main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0 16px;
  }
  h1 {
    margin: 0;
    font: 700 26px var(--font-display);
    letter-spacing: -0.01em;
  }
  .count {
    color: var(--muted);
    font-size: 13px;
    padding-top: 4px;
  }
  .grow {
    flex: 1;
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
    padding: 8px 8px var(--player-space) 6px;
    margin: 0 -6px 0 -6px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
    gap: 14px;
  }
  .none {
    padding: 20px 4px;
  }
  .panel {
    overflow-y: auto;
    padding: 20px 16px;
    margin-bottom: var(--player-space);
    border-radius: var(--radius-xl);
    animation: slide 0.5s var(--spring);
  }
  .panel > :global(*) {
    position: relative;
    z-index: 2;
  }
  @keyframes slide {
    from {
      opacity: 0;
      transform: translateX(30px) scale(0.97);
    }
  }
</style>
