<script lang="ts">
  // Fundo "acrílico" a partir da capa atual. Usa uma miniatura pequena (barata de
  // decodificar) ampliada com blur; troca com crossfade quando a faixa muda.
  import { Crossfade } from "../lib/crossfade.svelte";
  import { thumb } from "../lib/util";

  let { src, strength = 1 }: { src?: string; strength?: number } = $props();

  const bg = new Crossfade();
  $effect(() => bg.set(thumb(src, 120)));
</script>

<div class="bg" style:--strength={strength} aria-hidden="true">
  {#each bg.layers as l (l.id)}
    <img src={l.url} alt="" decoding="async" class:in={l.id === bg.shown} onload={() => bg.loaded(l.id)} onerror={() => bg.failed(l.id)} />
  {/each}
  <div class="shade"></div>
</div>

<style>
  .bg {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: radial-gradient(120% 80% at 20% 0%, #2a1418 0%, var(--bg) 60%);
    z-index: 0;
    contain: strict;
  }
  img {
    position: absolute;
    inset: -10%;
    width: 120%;
    height: 120%;
    object-fit: cover;
    filter: blur(48px) saturate(1.4) brightness(calc(0.62 * var(--strength)));
    opacity: 0;
    transition: opacity 0.8s ease;
  }
  img.in {
    opacity: 1;
  }
  .shade {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(8, 8, 12, 0.35) 0%, rgba(8, 8, 12, 0.55) 55%, rgba(8, 8, 12, 0.85) 100%),
      radial-gradient(90% 70% at 50% 40%, transparent 0%, rgba(0, 0, 0, 0.35) 100%);
  }
</style>
