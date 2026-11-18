<script lang="ts">
  // Fundo "acrílico" a partir da capa atual. Usa uma miniatura pequena (barata de
  // decodificar) ampliada com blur; troca com crossfade quando a faixa muda.
  import { thumb } from "../lib/util";

  let { src, strength = 1 }: { src?: string; strength?: number } = $props();

  let layers = $state<{ id: number; url: string }[]>([]);
  let n = 0;

  $effect(() => {
    const url = thumb(src, 120);
    if (!url || layers.at(-1)?.url === url) return;
    const id = ++n;
    layers = [...layers.slice(-1), { id, url }];
    const t = setTimeout(() => (layers = layers.filter((l) => l.id >= id)), 900);
    return () => clearTimeout(t);
  });
</script>

<div class="bg" style:--strength={strength} aria-hidden="true">
  {#each layers as l (l.id)}
    <img src={l.url} alt="" decoding="async" onload={(e) => e.currentTarget.classList.add("in")} />
  {/each}
  <div class="shade"></div>
</div>

<style>
  .bg {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: radial-gradient(120% 80% at 20% 0%, #1b2a3a 0%, var(--bg) 60%);
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
  img:global(.in) {
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
