import { mount } from "svelte";
import "./app.css";

// Sem menu de contexto do navegador (exceto em campos de texto).
window.addEventListener("contextmenu", (e) => {
  if (!(e.target as HTMLElement).closest("input, textarea, pre, .bio")) e.preventDefault();
});

const target = document.getElementById("app")!;

// Mesmo bundle para as duas janelas: "#island" monta só a ilha dinâmica.
if (location.hash === "#island") {
  document.documentElement.classList.add("island-mode");
  import("./Island.svelte").then((m) => mount(m.default, { target }));
} else {
  import("./App.svelte").then((m) => mount(m.default, { target }));
}
