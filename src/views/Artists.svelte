<script lang="ts">
  import Card from "../components/Card.svelte";
  import Icon from "../components/Icon.svelte";
  import Status from "../components/Status.svelte";
  import { api } from "../lib/api";
  import { player } from "../lib/player.svelte";
  import { keepScroll, plural } from "../lib/util";

  let attempt = $state(0);
  let filter = $state("");
  const data = $derived.by(() => { attempt; player.authVersion; return api.libraryArtists(); });
</script>

<div class="page">
  <div class="toolbar">
    <h1>Artistas</h1>
    {#await data then items}<span class="count">{plural(items.length, "artista", "artistas")}</span>{/await}
    <span class="grow"></span>
    <label class="field">
      <Icon name="filter" size={15} />
      <input bind:value={filter} placeholder="Filtrar" spellcheck="false" />
    </label>
  </div>
  <div class="scroll" use:keepScroll={"artists"}>
    {#await data}
      <div class="grid">
        {#each Array(12) as _}<div><div class="skeleton" style="aspect-ratio:1;border-radius:50%"></div></div>{/each}
      </div>
    {:then items}
      {#if player.signedIn === false && items.length === 0}
        <Status icon="user" title="Entre para ver seus artistas" action="Entrar com Google" onaction={() => player.login()} />
      {:else if items.length === 0}
        <Status icon="mic" title="Nenhum artista ainda" />
      {:else}
        {@const f = filter.trim().toLowerCase()}
        <div class="grid">
          {#each items.filter((a) => !f || a.title.toLowerCase().includes(f)) as a (a.id)}
            <Card item={a} />
          {/each}
        </div>
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
    padding: 8px 0 16px;
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
  .scroll {
    flex: 1;
    overflow-y: auto;
    padding: 8px 8px var(--player-space);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
    gap: 14px;
  }
</style>
