// Atualizações: verifica as releases do GitHub ao abrir e a cada 6 h.
import { checkUpdate, installUpdate, type Update } from "./api";

const DISMISS_KEY = "ymd.update.dismissed";

class Updates {
  available = $state<Update | null>(null);
  checking = $state(false);
  /** 0..1 durante o download; null fora dele. */
  progress = $state<number | null>(null);
  error = $state<string | null>(null);
  /** Última verificação manual terminou sem novidade. */
  upToDate = $state(false);
  dismissed = $state(localStorage.getItem(DISMISS_KEY) ?? "");

  constructor() {
    setTimeout(() => this.check(true), 8000);
    setInterval(() => this.check(true), 6 * 60 * 60_000);
  }

  /** Aviso no topo: há versão nova que o usuário ainda não dispensou. */
  get banner() {
    return !!this.available && this.dismissed !== this.available.version;
  }

  async check(silent = false) {
    if (this.checking || this.progress !== null) return;
    this.checking = true;
    if (!silent) {
      this.error = null;
      this.upToDate = false;
    }
    try {
      this.available = await checkUpdate();
      if (!silent) this.upToDate = !this.available;
    } catch (e) {
      if (!silent) this.error = String(e);
    } finally {
      this.checking = false;
    }
  }

  dismiss() {
    if (!this.available) return;
    this.dismissed = this.available.version;
    localStorage.setItem(DISMISS_KEY, this.dismissed);
  }

  async install() {
    const u = this.available;
    if (!u || this.progress !== null) return;
    this.error = null;
    this.progress = 0;
    try {
      await installUpdate(u, (p) => (this.progress = p));
      // o app fecha sozinho e o instalador o reabre
    } catch (e) {
      this.error = String(e);
      this.progress = null;
    }
  }
}

export const updates = new Updates();
