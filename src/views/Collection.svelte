<script lang="ts">
  import CollectionView from "../components/CollectionView.svelte";
  import type { Hint } from "../lib/router.svelte";
  import { keepScroll } from "../lib/util";

  let { id, hint }: { id: string; hint?: Hint } = $props();
</script>

<div class="page" use:keepScroll={"col:" + id}>
  {#key id}<CollectionView {id} {hint} layout="page" />{/key}
</div>

<style>
  .page {
    height: 100%;
    overflow-y: auto;
    padding: 12px 32px var(--player-space);
  }
</style>
