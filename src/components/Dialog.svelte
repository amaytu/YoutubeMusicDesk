<script lang="ts">
  // Diálogo modal (texto ou confirmação) no estilo de vidro do app.
  import { backOut } from "svelte/easing";
  import { fade, scale } from "svelte/transition";
  import { dialog } from "../lib/dialog.svelte";

  let value = $state("");
  let input = $state<HTMLInputElement>();

  $effect(() => {
    const r = dialog.req;
    if (!r) return;
    value = r.value ?? "";
    // foca e seleciona o texto depois da animação de entrada começar
    setTimeout(() => (input?.focus(), input?.select()), 30);
  });

  function ok() {
    const r = dialog.req;
    if (!r) return;
    if (r.kind === "prompt") {
      if (!value.trim()) return input?.focus();
      dialog.close(value.trim());
    } else dialog.close("ok");
  }
  function onKey(e: KeyboardEvent) {
    if (!dialog.req) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      dialog.close(null);
    } else if (e.key === "Enter") {
      e.preventDefault();
      ok();
    }
  }
</script>

<svelte:window onkeydowncapture={onKey} />

{#if dialog.req}
  {@const r = dialog.req}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div class="scrim" transition:fade={{ duration: 160 }} onclick={() => dialog.close(null)}></div>
  <div class="box glass" role="dialog" aria-modal="true" aria-label={r.title} transition:scale={{ start: 0.94, duration: 260, easing: backOut }}>
    <h3>{r.title}</h3>
    {#if r.message}<p>{r.message}</p>{/if}
    {#if r.kind === "prompt"}
      <input bind:this={input} bind:value placeholder={r.placeholder} maxlength="150" spellcheck="false" />
    {/if}
    <div class="actions">
      <button class="btn" onclick={() => dialog.close(null)}>Cancelar</button>
      <button class="btn primary" class:danger={r.danger} disabled={r.kind === "prompt" && !value.trim()} onclick={ok}>{r.confirm}</button>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 120;
    background: rgba(0, 0, 0, 0.45);
  }
  .box {
    position: fixed;
    z-index: 121;
    left: 50%;
    top: 50%;
    translate: -50% -50%;
    width: min(400px, calc(100vw - 32px));
    padding: 22px 22px 18px;
    border-radius: 22px;
    background: linear-gradient(160deg, rgba(34, 34, 46, 0.96), rgba(20, 20, 28, 0.96));
  }
  h3 {
    margin: 0 0 6px;
    font-size: 17px;
    font-weight: 750;
  }
  p {
    margin: 0 0 4px;
    color: var(--text-2, rgba(255, 255, 255, 0.7));
    font-size: 13.5px;
    line-height: 1.45;
  }
  input {
    width: 100%;
    box-sizing: border-box;
    margin-top: 12px;
    padding: 11px 14px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: inherit;
    font: inherit;
    font-size: 14.5px;
    outline: none;
    transition: border-color 0.2s, background 0.2s;
  }
  input:focus {
    border-color: var(--dyn-strong, var(--accent));
    background: rgba(255, 255, 255, 0.09);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 18px;
  }
  .btn.danger {
    background: #d92d3a;
  }
  .btn:disabled {
    opacity: 0.45;
    pointer-events: none;
  }
</style>
