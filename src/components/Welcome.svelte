<script lang="ts">
  // Primeira abertura sem conta: um clique leva ao login do Google.
  import { backOut } from "svelte/easing";
  import { fade, scale } from "svelte/transition";
  import { player } from "../lib/player.svelte";
  import Icon from "./Icon.svelte";
  import Logo from "./Logo.svelte";

  const KEY = "ymd.welcome.dismissedAt";
  const DAYS = 7;

  let dismissed = $state(Date.now() - Number(localStorage.getItem(KEY) ?? 0) < DAYS * 864e5);
  let waiting = $state(false);
  const show = $derived(player.signedIn === false && !dismissed);

  function later() {
    localStorage.setItem(KEY, String(Date.now()));
    dismissed = true;
  }
  function login() {
    waiting = true;
    player.login();
  }
</script>

{#if show}
  <div class="overlay" transition:fade={{ duration: 200 }}>
    <div class="card glass" in:scale={{ start: 0.9, duration: 420, easing: backOut }}>
      <div class="logo"><Logo size={104} /></div>
      <h1>Bem-vindo ao YouTube Music Desk</h1>
      <p>Entre com sua conta Google para ver suas playlists, curtidas e recomendações. É só uma vez — depois o app já abre conectado.</p>
      <button class="btn primary big" onclick={login}>
        <Icon name="google" size={18} />
        {waiting ? "Concluindo login na janela aberta…" : "Entrar com Google"}
      </button>
      <button class="later" onclick={later}>Explorar sem conta</button>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    background: rgba(6, 6, 10, 0.6);
    backdrop-filter: blur(6px);
  }
  .card {
    width: min(420px, 90vw);
    padding: 36px 32px 24px;
    border-radius: var(--radius-xl);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .card > * {
    position: relative;
    z-index: 2;
  }
  .logo {
    margin-bottom: 4px;
    filter: drop-shadow(0 14px 30px rgba(255, 0, 0, 0.4));
    animation: float 3.2s ease-in-out infinite;
  }
  @keyframes float {
    50% {
      transform: translateY(-6px) rotate(-2deg);
    }
  }
  h1 {
    margin: 0;
    font: 700 22px var(--font-display);
  }
  p {
    margin: 0 0 10px;
    color: var(--muted);
    line-height: 1.5;
  }
  .big {
    height: 46px;
    width: 100%;
    justify-content: center;
    font-size: 13px;
  }
  .later {
    color: var(--muted);
    padding: 8px;
    font-size: 13px;
  }
  .later:hover {
    color: var(--text);
  }
</style>
