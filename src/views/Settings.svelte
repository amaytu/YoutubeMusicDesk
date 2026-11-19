<script lang="ts">
  // Configurações: tudo que antes só existia no menu da bandeja, mais tradução,
  // atualizações e atalhos.
  import { getPrefs, setPref, type Prefs } from "../lib/api";
  import { appearance } from "../lib/fx.svelte";
  import { lyricsPrefs } from "../lib/lyrics.svelte";
  import { player } from "../lib/player.svelte";
  import { playlists } from "../lib/playlists.svelte";
  import { updates } from "../lib/updates.svelte";
  import Icon from "../components/Icon.svelte";
  import { keepScroll } from "../lib/util";

  let prefs = $state<Prefs | null>(null);
  let busy = $state<string | null>(null);
  let deepl = $state("");

  getPrefs().then((p) => (prefs = p)).catch(() => {});

  async function set(key: string, value: unknown) {
    if (busy) return;
    busy = key;
    try {
      prefs = await setPref(key, value);
    } catch (e) {
      playlists.notify(String(e), undefined, true);
    } finally {
      busy = null;
    }
  }

  async function saveDeepl(clear = false) {
    await set("deeplKey", clear ? "" : deepl.trim());
    deepl = "";
    playlists.notify(clear ? "Chave do DeepL removida" : "Chave do DeepL salva");
  }

  type Row = { key: keyof Prefs; label: string; hint: string };
  const general: Row[] = [
    { key: "autostart", label: "Iniciar com o Windows", hint: "Abre minimizado na bandeja ao ligar o PC." },
    { key: "closeToTray", label: "Fechar para a bandeja", hint: "O X esconde a janela e a música continua. Desligado, o X encerra o app." },
    { key: "economy", label: "Modo economia em segundo plano", hint: "Minimizado ou na bandeja, usa menos memória e CPU." },
  ];
  const playback: Row[] = [
    { key: "mediaKeys", label: "Teclas de mídia do teclado", hint: "Tocar/pausar, próxima e anterior funcionam com o app em segundo plano." },
    { key: "island", label: "Ilha dinâmica", hint: "Pílula no topo da tela com a letra quando o app está em segundo plano." },
  ];

  const shortcuts: [string, string][] = [
    ["Espaço", "Tocar / pausar"],
    ["Ctrl + →  /  Ctrl + ←", "Próxima / anterior"],
    ["Ctrl + ↑  /  Ctrl + ↓", "Volume"],
    ["M", "Sem som"],
    ["L", "Curtir a música atual"],
    ["Ctrl + F", "Buscar"],
    ["Ctrl + ,", "Configurações"],
    ["Alt + ←  /  botão voltar do mouse", "Voltar"],
    ["Esc", "Fechar o Tocando agora"],
  ];
</script>

<div class="page" use:keepScroll={"settings"}>
<div class="settings">
  <div class="top">
    <h1>Configurações</h1>
    {#if updates.available}
      <button class="btn primary" disabled={updates.progress !== null} onclick={() => updates.install()}>
        <Icon name="download" size={14} />
        {updates.progress !== null ? `Baixando ${Math.round(updates.progress * 100)}%` : `Atualizar para ${updates.available.version}`}
      </button>
    {:else}
      <button class="btn" disabled={updates.checking} onclick={() => updates.check()}>
        <Icon name="refresh" size={14} />
        {updates.checking ? "Verificando…" : updates.upToDate ? "Está atualizado" : "Verificar atualizações"}
      </button>
    {/if}
  </div>

  {#snippet toggle(on: boolean, label: string, hint: string, onclick: () => void, disabled = false)}
    <button class="row" role="switch" aria-checked={on} {disabled} {onclick}>
      <span class="text"><span class="label">{label}</span><span class="hint">{hint}</span></span>
      <span class="switch" class:on><i></i></span>
    </button>
  {/snippet}

  <section class="card glass">
    <h2>Geral</h2>
    {#if prefs}
      {#each general as r (r.key)}
        {@render toggle(!!prefs[r.key], r.label, r.hint, () => set(r.key, !prefs![r.key]), busy !== null)}
      {/each}
    {:else}
      {#each general as _}<div class="skeleton" style="height:52px;margin:6px 0"></div>{/each}
    {/if}
  </section>

  <section class="card glass">
    <h2>Reprodução</h2>
    {#if prefs}
      {#each playback as r (r.key)}
        {@render toggle(!!prefs[r.key], r.label, r.hint, () => set(r.key, !prefs![r.key]), busy !== null)}
      {/each}
    {/if}
    {@render toggle(appearance.glass, "Efeitos de vidro", "Desfoque e refração estilo liquid glass. Desligue em PCs mais fracos.", () => appearance.toggleGlass())}
  </section>

  <section class="card glass">
    <h2>Letras</h2>
    {@render toggle(lyricsPrefs.translate, "Traduzir letras para português", "Mostra a tradução embaixo de cada linha, seguindo a música.", () => lyricsPrefs.toggleTranslate())}
    <div class="row static">
      <span class="text">
        <span class="label">Tradutor DeepL (opcional)</span>
        <span class="hint">
          {#if prefs?.deepl}Usando o DeepL com a sua chave.{:else}Sem chave, a tradução usa o Google Tradutor.{/if}
        </span>
      </span>
    </div>
    <form class="key" onsubmit={(e) => (e.preventDefault(), deepl.trim() && saveDeepl())}>
      <input type="password" bind:value={deepl} placeholder={prefs?.deepl ? "Trocar chave da API do DeepL" : "Chave da API do DeepL"} autocomplete="off" spellcheck="false" />
      <button class="btn" type="submit" disabled={!deepl.trim() || busy !== null}>Salvar</button>
      {#if prefs?.deepl}<button class="btn" type="button" onclick={() => saveDeepl(true)}>Remover</button>{/if}
    </form>
  </section>

  <section class="card glass">
    <h2>Atualizações</h2>
    <div class="row static">
      <span class="text">
        <span class="label">YouTube Music Desk {prefs?.version ?? ""}</span>
        <span class="hint">
          {#if updates.progress !== null}
            Baixando a versão {updates.available?.version}… {Math.round(updates.progress * 100)}%
          {:else if updates.available}
            Versão {updates.available.version} disponível.
          {:else if updates.checking}
            Verificando…
          {:else if updates.error}
            {updates.error}
          {:else if updates.upToDate}
            Você está na versão mais recente.
          {:else}
            O app verifica sozinho ao abrir e a cada 6 horas.
          {/if}
        </span>
      </span>
      {#if updates.available}
        <button class="btn primary" disabled={updates.progress !== null} onclick={() => updates.install()}>
          <Icon name="download" size={14} /> Atualizar agora
        </button>
      {:else}
        <button class="btn" disabled={updates.checking} onclick={() => updates.check()}>
          <Icon name="refresh" size={14} /> Verificar
        </button>
      {/if}
    </div>
  </section>

  <section class="card glass">
    <h2>Conta</h2>
    <div class="row static">
      <span class="text">
        <span class="label">{player.signedIn ? "Conectado ao YouTube Music" : "Não conectado"}</span>
        <span class="hint">O login é feito direto no Google; o app não vê a sua senha.</span>
      </span>
      {#if player.signedIn}
        <button class="btn" onclick={() => player.login()}>Trocar</button>
        <button class="btn" onclick={() => player.logout()}>Sair</button>
      {:else}
        <button class="btn primary" onclick={() => player.login()}>Entrar com Google</button>
      {/if}
    </div>
  </section>

  <section class="card glass">
    <h2>Atalhos de teclado</h2>
    <div class="keys">
      {#each shortcuts as [k, what]}
        <kbd>{k}</kbd><span>{what}</span>
      {/each}
    </div>
  </section>
</div>
</div>

<style>
  .page {
    height: 100%;
    overflow-y: auto;
    padding: 4px var(--gutter) var(--player-space);
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .settings {
    max-width: 760px;
    margin: 0 auto;
    padding: 8px 4px 40px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  h1 {
    margin: 4px 0 6px;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .card {
    padding: 14px 16px 10px;
    border-radius: 20px;
  }
  h2 {
    margin: 0 0 4px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3, rgba(255, 255, 255, 0.5));
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 8px;
    border-radius: 12px;
    text-align: left;
    color: inherit;
    transition: background 0.2s;
  }
  button.row:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  .row + .row {
    border-top: 1px solid var(--line, rgba(255, 255, 255, 0.06));
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .label {
    font-size: 14.5px;
    font-weight: 600;
  }
  .hint {
    font-size: 12.5px;
    color: var(--text-2, rgba(255, 255, 255, 0.6));
    line-height: 1.4;
  }
  .switch {
    flex: none;
    width: 38px;
    height: 22px;
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.16);
    position: relative;
    transition: background 0.25s;
  }
  .switch i {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.3s var(--spring, ease);
  }
  .switch.on {
    background: var(--dyn-strong, var(--accent));
  }
  .switch.on i {
    transform: translateX(16px);
  }
  .key {
    display: flex;
    gap: 8px;
    padding: 0 8px 10px;
  }
  .key input {
    flex: 1;
    min-width: 0;
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: inherit;
    font: inherit;
    font-size: 13.5px;
    outline: none;
  }
  .key input:focus {
    border-color: var(--dyn-strong, var(--accent));
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
  }
  .btn:disabled {
    opacity: 0.5;
    pointer-events: none;
  }
  .keys {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px 16px;
    align-items: center;
    padding: 8px 8px 10px;
    font-size: 13.5px;
  }
  kbd {
    font: 600 12px/1 ui-monospace, "Cascadia Code", Consolas, monospace;
    padding: 5px 8px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.12) inset, 0 1px 2px rgba(0, 0, 0, 0.4);
    white-space: nowrap;
    justify-self: start;
  }
  @media (max-width: 560px) {
    .keys {
      grid-template-columns: 1fr;
      gap: 4px;
    }
    .keys span {
      margin-bottom: 6px;
    }
  }
</style>
