// Injetado em todas as páginas antes do carregamento. Só age no YouTube Music.
// Expõe window.__ymd para o Rust controlar a reprodução via webview.eval().
(() => {
  if (window.__ymd || location.hostname !== "music.youtube.com") return;

  const q = (sel) => document.querySelector(sel);
  const click = (...sels) => {
    for (const s of sels) {
      const el = q(s);
      if (el) { el.click(); return true; }
    }
    return false;
  };

  window.__ymd = {
    playPause() {
      if (click("ytmusic-player-bar #play-pause-button", "#play-pause-button")) return;
      const v = q("video");
      if (v) v.paused ? v.play() : v.pause();
    },
    next() { click("ytmusic-player-bar .next-button", ".next-button"); },
    prev() { click("ytmusic-player-bar .previous-button", ".previous-button"); },
  };
})();
