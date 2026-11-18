<script lang="ts">
  // Estados de vazio/erro com ação opcional.
  import Icon from "./Icon.svelte";

  let {
    icon = "note",
    title,
    message = "",
    action,
    onaction,
  }: { icon?: string; title: string; message?: string; action?: string; onaction?: () => void } = $props();
</script>

<div class="status">
  <div class="ico"><Icon name={icon} size={30} /></div>
  <h3>{title}</h3>
  {#if message}<p>{message}</p>{/if}
  {#if action}<button class="btn primary" onclick={onaction}>{action}</button>{/if}
</div>

<style>
  .status {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 60px 20px;
    text-align: center;
    animation: fade 0.3s ease;
  }
  .ico {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.06);
    color: var(--muted);
  }
  h3 {
    margin: 6px 0 0;
    font: 600 18px var(--font-display);
  }
  p {
    margin: 0 0 8px;
    max-width: 420px;
    color: var(--muted);
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
