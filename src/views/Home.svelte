<script lang="ts">
  import Shelf from "../components/Shelf.svelte";
  import Status from "../components/Status.svelte";
  import { api } from "../lib/api";
  import { player } from "../lib/player.svelte";
  import { keepScroll } from "../lib/util";

  let attempt = $state(0);
  const data = $derived.by(() => { attempt; player.authVersion; return api.home(); });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
</script>

<div class="page" use:keepScroll={"home"}>
  <h1>{greeting}</h1>
  {#await data}
    {#each Array(3) as _}
      <div class="skeleton" style="height:22px;width:220px;margin:8px 4px 14px"></div>
      <div class="sk-row">{#each Array(6) as _}<div class="skeleton" style="aspect-ratio:1"></div>{/each}</div>
    {/each}
  {:then shelves}
    {#each shelves as shelf, i (i)}
      <Shelf {shelf} />
    {:else}
      <Status title="Nada para mostrar" message="O YouTube Music não retornou recomendações." action="Atualizar" onaction={() => attempt++} />
    {/each}
  {:catch e}
    <Status title="Não foi possível carregar o início" message={String(e)} action="Tentar de novo" onaction={() => attempt++} />
  {/await}
</div>

<style>
  .page {
    height: 100%;
    overflow-y: auto;
    padding: 4px 24px 24px;
  }
  h1 {
    margin: 4px 4px 18px;
    font: 700 32px var(--font-display);
    letter-spacing: -0.02em;
  }
  .sk-row {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 14px;
    margin-bottom: 30px;
  }
</style>
