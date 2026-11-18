<script lang="ts">
  // Primeira abertura sem conta: um clique leva ao login do Google.
  import { fade, scale } from "svelte/transition";
  import { player } from "../lib/player.svelte";
  import Icon from "./Icon.svelte";

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
    <div class="card" in:scale={{ start: 0.96, duration: 260 }}>
      <div class="logo">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
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
    border-radius: 20px;
    background: rgba(22, 22, 30, 0.92);
    border: 1px solid var(--line);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .logo {
    width: 72px;
    height: 72px;
    border-radius: 18px;
    background: linear-gradient(160deg, #7c3aed, #ec4899);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 4px;
    padding-bottom: 16px;
    margin-bottom: 6px;
  }
  .logo span {
    width: 7px;
    border-radius: 4px;
    background: #fff;
    animation: eq 1.2s ease-in-out infinite;
  }
  .logo span:nth-child(1) { height: 16px; animation-delay: -0.2s; }
  .logo span:nth-child(2) { height: 30px; animation-delay: -0.5s; }
  .logo span:nth-child(3) { height: 24px; animation-delay: -0.8s; }
  .logo span:nth-child(4) { height: 36px; animation-delay: -0.1s; }
  .logo span:nth-child(5) { height: 20px; animation-delay: -0.6s; }
  @keyframes eq {
    50% { transform: scaleY(0.55); }
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
