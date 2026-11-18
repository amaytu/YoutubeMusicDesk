# YouTube Music Desk

Cliente desktop leve para o **YouTube Music** no Windows, feito em **Rust + Tauri v2**.
Inspirado no [spotifast](https://github.com/crmne/spotifast): foco em inicialização rápida,
pouca RAM e quase nenhum uso de CPU em segundo plano.

> Projeto não oficial, sem vínculo com o Google/YouTube. Usa o site oficial
> `music.youtube.com` — nada de API não documentada ou extração de streams.

## Por que Tauri e não nativo como o spotifast?

O spotifast toca áudio nativamente via `librespot` porque o Spotify tem API de playback.
O YouTube Music não tem; um player nativo dependeria de engenharia reversa (quebra
com frequência e viola os termos). A alternativa mais leve e estável é o **WebView2**,
que já vem no Windows 10/11 e é compartilhado com o Edge — diferente do Electron,
que embute um Chromium inteiro por app.

| | Electron (ex.: th-ch/youtube-music) | YouTube Music Desk |
|---|---|---|
| Instalador | ~90 MB | ~3–5 MB |
| Processo host | ~80–150 MB | ~5–15 MB |
| Engine | Chromium embutido | WebView2 do sistema |

## Recursos

- **Bandeja do sistema**: clique esquerdo mostra/esconde; menu com tocar/pausar,
  próxima, anterior e opções. O tooltip mostra a faixa atual.
- **Teclas de mídia globais** (Play/Pause, Próxima, Anterior).
- **Modo economia em segundo plano**: ao esconder ou minimizar,
  - WebView2 entra em `MemoryUsageTargetLevel = Low` (libera caches/memória);
  - o processo host recebe **EcoQoS** (núcleos de eficiência, menor frequência);
  - o áudio continua normalmente.
- **Fechar para a bandeja** (opcional).
- **Iniciar com o Windows** (abre escondido, direto na bandeja).
- **Instância única**: abrir de novo só traz a janela para frente.
- **Posição e tamanho da janela lembrados**.
- **Links externos** abrem no navegador padrão; só YouTube e login do Google rodam no app.
- WebView2 enxuto: Tradutor, SmartScreen, MediaRouter (Cast), OptimizationHints e
  rede em segundo plano do navegador desativados; `--process-per-site` para menos processos.

## Login com o Google

Pensado para ser feito uma vez só, em poucos cliques:

1. Na primeira abertura sem conta, aparece **"Entrar com Google"** — um clique leva
   direto à tela de login do Google (sem passar pelas páginas intermediárias do YouTube).
2. E-mail → senha (ou passkey/Windows Hello) → volta ao player já conectado.
3. A sessão fica salva no perfil do WebView2; nas próximas aberturas já entra logado.

"Agora não" esconde o convite por 7 dias. A qualquer momento, pela bandeja:
**Entrar com Google / Trocar conta** ou **Sair da conta** (apaga cookies e dados do app).

**Sobre o bloqueio do Google:** o Google recusa login em navegadores embutidos
(WebView2 incluso) com a mensagem *"Este navegador ou app pode não ser seguro"*.
Para contornar, o app troca o user agent **apenas nas páginas de login** e restaura
o original ao voltar para `music.youtube.com`. Se ainda assim for recusado, aparece um
aviso com "Tentar de novo". Dá para trocar o UA usado no login em `login_user_agent`
ou desligar o recurso com `login_ua_switch: false`.

## Configurações

As opções do menu da bandeja são salvas em
`%APPDATA%\com.amaytu.youtubemusicdesk\settings.json`:

```json
{
  "close_to_tray": true,
  "economy_when_hidden": true,
  "media_keys": true,
  "user_agent": null,
  "extra_browser_args": null,
  "login_ua_switch": true,
  "login_user_agent": null
}
```

- `user_agent`: use se o login do Google disser que o navegador não é seguro.
- `extra_browser_args`: flags extras do WebView2, por ex. `"--renderer-process-limit=1"`
  para economizar ainda mais RAM (exige reiniciar o app).
- Ligar/desligar `media_keys` vale na hora; a flag que desativa o tratamento de teclas
  do próprio Chromium só muda ao reiniciar.

## Build

Pré-requisitos: [Rust](https://rustup.rs) (stable, MSVC) e o
[Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
com "Desenvolvimento para desktop com C++".

```powershell
cargo install tauri-cli --version "^2" --locked

# rodar em modo dev
cargo tauri dev

# gerar instaladores (NSIS .exe e .msi) em src-tauri\target\release\bundle\
cargo tauri build
```

O GitHub Actions (`.github/workflows/build.yml`) compila a cada push na `main` e
publica um release ao criar uma tag `v*`.

## Estrutura

```
src-tauri/
  src/main.rs      plugins, setup e eventos da janela
  src/window.rs    janela WebView2, flags do navegador, filtro de navegação
  src/tray.rs      ícone/menu da bandeja e tooltip da faixa
  src/login.rs     login do Google (UA só no login, entrar/sair pela bandeja)
  src/media.rs     teclas de mídia globais -> comandos na página
  src/power.rs     modo economia (memória WebView2 + EcoQoS)
  src/settings.rs  configurações em JSON
  src/inject.js    ponte na página: controles + tela "Entrar com Google"
scripts/gen-icons.py  gera os ícones (Pillow)
```

## Roadmap

- [ ] Mini player compacto sempre no topo
- [ ] Discord Rich Presence ("Ouvindo ...")
- [ ] Integração com SMTC (overlay de mídia do Windows e tela de bloqueio)
- [ ] Atalhos configuráveis
- [ ] Atualização automática (tauri-plugin-updater)

## Licença

MIT
