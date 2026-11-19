<script lang="ts">
  // Aviso discreto de versão nova (abaixo da barra de título).
  import { backOut } from "svelte/easing";
  import { fly } from "svelte/transition";
  import { updates } from "../lib/updates.svelte";
  import Icon from "./Icon.svelte";
</script>

{#if updates.banner && updates.available}
  <div class="upd glass" transition:fly={{ y: 24, duration: 420, easing: backOut }} role="status">
    <span class="ico"><Icon name="download" size={16} /></span>
    {#if updates.progress !== null}
      <span class="txt">Baixando a versão {updates.available.version}…</span>
      <span class="bar"><i style:width="{Math.round(updates.progress * 100)}%"></i></span>
    {:else}
      <span class="txt">
        {#if updates.error}<b>Falhou:</b> {updates.error}{:else}Versão <b>{updates.available.version}</b> disponível{/if}
      </span>
      <button class="btn primary sm" onclick={() => updates.install()}>{updates.error ? "Tentar de novo" : "Atualizar agora"}</button>
      <button class="icon-btn sm" title="Depois" onclick={() => updates.dismiss()}><Icon name="close" size={14} /></button>
    {/if}
  </div>
{/if}

<style>
  .upd {
    position: fixed;
    z-index: 45;
    /* canto inferior direito, acima da barra do player (não cobre o conteúdo) */
    right: 18px;
    bottom: calc(var(--playerbar) + 30px);
    max-width: calc(100vw - 36px);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 8px 7px 14px;
    border-radius: 999px;
    background: linear-gradient(160deg, rgba(34, 34, 46, 0.94), rgba(20, 20, 28, 0.94));
    font-size: 13px;
    white-space: nowrap;
  }
  @media (max-width: 700px) {
    .upd {
      right: 12px;
      left: 12px;
      bottom: calc(var(--playerbar) + var(--bottomnav) + 40px);
    }
    .txt {
      flex: 1;
    }
  }
  .ico {
    color: var(--dyn-strong, var(--accent));
    display: grid;
  }
  .txt {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .btn.sm {
    padding: 5px 12px;
    font-size: 12.5px;
  }
  .icon-btn.sm {
    width: 26px;
    height: 26px;
  }
  .bar {
    width: 140px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.12);
    overflow: hidden;
    margin-right: 8px;
  }
  .bar i {
    display: block;
    height: 100%;
    background: var(--dyn-strong, var(--accent));
    transition: width 0.25s;
  }
</style>
