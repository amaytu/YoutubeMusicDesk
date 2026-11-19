<script lang="ts">
  // Aviso curto (ex.: "Adicionada a …").
  import { backOut } from "svelte/easing";
  import { fly } from "svelte/transition";
  import { playlists } from "../lib/playlists.svelte";
  import Cover from "./Cover.svelte";
  import Icon from "./Icon.svelte";
</script>

{#if playlists.toast}
  {#key playlists.toast.id}
    <div class="toast glass" class:error={playlists.toast.error} transition:fly={{ y: 20, duration: 360, easing: backOut }}>
      {#if playlists.toast.thumb}
        <div class="t-art"><Cover src={playlists.toast.thumb} size={60} eager /></div>
      {:else}
        <Icon name={playlists.toast.error ? "close" : "check"} size={16} />
      {/if}
      <span>{playlists.toast.text}</span>
    </div>
  {/key}
{/if}

<style>
  .toast {
    position: fixed;
    z-index: 110;
    left: 50%;
    bottom: calc(var(--playerbar) + 30px);
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: min(460px, calc(100vw - 24px));
    padding: 8px 16px 8px 8px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    background: linear-gradient(160deg, rgba(36, 36, 46, 0.95), rgba(22, 22, 30, 0.95));
  }
  .toast > * {
    position: relative;
    z-index: 2;
  }
  .toast.error {
    color: #ffb3bc;
  }
  .t-art {
    width: 28px;
    flex: none;
  }
  .t-art :global(.cover) {
    border-radius: 50%;
  }
  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  @media (max-width: 700px) {
    .toast {
      bottom: calc(var(--playerbar) + var(--bottomnav) + 40px);
    }
  }
</style>
