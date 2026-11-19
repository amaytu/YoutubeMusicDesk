// Caixas de diálogo próprias (nome de playlist, confirmação), no visual do app.
export interface DialogReq {
  kind: "prompt" | "confirm";
  title: string;
  message?: string;
  placeholder?: string;
  value?: string;
  confirm: string;
  danger?: boolean;
  resolve: (v: string | null) => void;
}

class Dialog {
  req = $state<DialogReq | null>(null);

  #open(r: Omit<DialogReq, "resolve">) {
    this.req?.resolve(null);
    return new Promise<string | null>((resolve) => (this.req = { ...r, resolve }));
  }
  /** Pede um texto. null = cancelou. */
  prompt(title: string, opts: { placeholder?: string; value?: string; confirm?: string; message?: string } = {}) {
    return this.#open({ kind: "prompt", title, confirm: opts.confirm ?? "OK", ...opts });
  }
  /** Pede confirmação. */
  async confirm(title: string, opts: { message?: string; confirm?: string; danger?: boolean } = {}) {
    return (await this.#open({ kind: "confirm", title, confirm: opts.confirm ?? "OK", ...opts })) !== null;
  }
  close(value: string | null) {
    const r = this.req;
    this.req = null;
    r?.resolve(value);
  }
}

export const dialog = new Dialog();
