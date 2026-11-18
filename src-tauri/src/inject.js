// Injetado antes do carregamento de cada página (só no frame principal).
// - music.youtube.com: expõe window.__ymd (controles) e mostra a tela de boas-vindas
//   com "Entrar com Google" quando não há conta conectada.
// - accounts.google.com: se o Google recusar o login, mostra um aviso com "Tentar de novo".
// Usa apenas APIs de DOM (sem innerHTML) por causa do Trusted Types do YouTube.
(() => {
  if (window.__ymdLoaded) return;
  window.__ymdLoaded = true;

  const LOGIN_URL =
    "https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26app%3Ddesktop%26next%3Dhttps%253A%252F%252Fmusic.youtube.com%252F";
  const DISMISS_KEY = "ymd.login.dismissedAt";
  const DISMISS_DAYS = 7;

  const q = (sel) => document.querySelector(sel);
  const onReady = (fn) =>
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn, { once: true }) : fn();

  const el = (tag, style, text) => {
    const e = document.createElement(tag);
    if (style) Object.assign(e.style, style);
    if (text) e.textContent = text;
    return e;
  };

  const button = (text, primary, onClick) => {
    const b = el("button", {
      font: "500 15px Roboto, Arial, sans-serif",
      padding: "12px 28px",
      borderRadius: "999px",
      border: primary ? "none" : "1px solid #555",
      background: primary ? "#fff" : "transparent",
      color: primary ? "#030303" : "#fff",
      cursor: "pointer",
      width: "100%",
    }, text);
    b.addEventListener("click", onClick);
    return b;
  };

  const card = (title, message, actions) => {
    const overlay = el("div", {
      position: "fixed", inset: "0", zIndex: "2147483647",
      background: "rgba(0,0,0,.72)", display: "flex",
      alignItems: "center", justifyContent: "center",
    });
    const box = el("div", {
      background: "#212121", color: "#fff", borderRadius: "16px",
      padding: "32px", width: "min(380px, 90vw)", boxSizing: "border-box",
      display: "flex", flexDirection: "column", gap: "14px",
      font: "14px Roboto, Arial, sans-serif", textAlign: "center",
      boxShadow: "0 12px 40px rgba(0,0,0,.5)",
    });
    box.append(
      el("div", { font: "600 20px Roboto, Arial, sans-serif" }, title),
      el("div", { color: "#aaa", lineHeight: "1.5", marginBottom: "8px" }, message),
      ...actions.map(([text, primary, fn]) => button(text, primary, () => fn(overlay))),
    );
    overlay.append(box);
    document.body.append(overlay);
    return overlay;
  };

  // ---------- YouTube Music ----------
  if (location.hostname === "music.youtube.com") {
    const click = (...sels) => {
      for (const s of sels) {
        const e = q(s);
        if (e) { e.click(); return true; }
      }
      return false;
    };

    const signInLink = () => q("ytmusic-nav-bar a.sign-in-link, a.sign-in-link");
    // Avatar da conta na barra superior.
    const isSignedIn = () => !!q("ytmusic-nav-bar ytmusic-settings-button img");
    // Prefere o link do próprio YouTube Music (sempre com os parâmetros atuais).
    const login = () => { location.href = signInLink()?.href || LOGIN_URL; };

    window.__ymd = {
      playPause() {
        if (click("ytmusic-player-bar #play-pause-button", "#play-pause-button")) return;
        const v = q("video");
        if (v) v.paused ? v.play() : v.pause();
      },
      next() { click("ytmusic-player-bar .next-button", ".next-button"); },
      prev() { click("ytmusic-player-bar .previous-button", ".previous-button"); },
      login,
    };

    const dismissedRecently = () => {
      try {
        const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
        return Date.now() - t < DISMISS_DAYS * 864e5;
      } catch { return false; }
    };

    onReady(() => {
      if (dismissedRecently()) return;
      // Espera a barra superior renderizar para saber se há conta conectada.
      let tries = 0;
      const timer = setInterval(() => {
        tries++;
        if (!signInLink()) {
          if (isSignedIn() || tries > 30) clearInterval(timer);
          return;
        }
        clearInterval(timer);
        card(
          "Bem-vindo ao YouTube Music Desk",
          "Entre com sua conta Google para ver suas playlists, músicas curtidas e recomendações. Você só precisa fazer isso uma vez.",
          [
            ["Entrar com Google", true, login],
            ["Agora não", false, (o) => {
              try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
              o.remove();
            }],
          ],
        );
      }, 500);
    });
    return;
  }

  // ---------- Login do Google recusado ----------
  if (/^accounts\.google\./.test(location.hostname) && location.pathname.includes("/signin/rejected")) {
    onReady(() =>
      card(
        "O Google não aceitou o login",
        "Às vezes o Google bloqueia o login dentro de apps. Tente de novo; se continuar, feche o app pela bandeja e abra novamente.",
        [
          ["Tentar de novo", true, () => { location.href = LOGIN_URL; }],
          ["Voltar ao YouTube Music", false, () => { location.href = "https://music.youtube.com/"; }],
        ],
      ),
    );
  }
})();
