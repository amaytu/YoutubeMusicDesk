<script lang="ts">
  import CollectionView from "../components/CollectionView.svelte";
  import { keepScroll } from "../lib/util";

  let { id }: { id: string } = $props();
</script>

<div class="page" use:keepScroll={"col:" + id}>
  {#key id}<CollectionView {id} layout="page" />{/key}
</div>

<style>
  .page {
    height: 100%;
    overflow-y: auto;
    padding: 12px 32px 24px;
  }
</style>
