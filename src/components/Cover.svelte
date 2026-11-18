<script lang="ts">
  import { thumb } from "../lib/util";
  import Icon from "./Icon.svelte";

  let {
    src,
    size = 226,
    round = false,
    alt = "",
    eager = false,
    icon = "note",
  }: { src?: string; size?: number; round?: boolean; alt?: string; eager?: boolean; icon?: string } = $props();

  let loaded = $state(false);
  let failed = $state(false);
  const url = $derived(thumb(src, size));
  $effect(() => {
    url;
    loaded = false;
    failed = false;
  });
</script>

<div class="cover" class:round>
  {#if url && !failed}
    <img
      src={url}
      {alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable="false"
      class:loaded
      onload={() => (loaded = true)}
      onerror={() => (failed = true)}
    />
  {/if}
  {#if !url || failed}
    <div class="ph"><Icon name={icon} size={28} /></div>
  {/if}
</div>

<style>
  .cover {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.06);
    flex: none;
  }
  .round {
    border-radius: 50%;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.25s ease;
  }
  img.loaded {
    opacity: 1;
  }
  .ph {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--faint);
  }
</style>
