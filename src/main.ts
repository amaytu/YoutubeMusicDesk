import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

// Sem menu de contexto do navegador (exceto em campos de texto).
window.addEventListener("contextmenu", (e) => {
  if (!(e.target as HTMLElement).closest("input, textarea, pre, .bio")) e.preventDefault();
});

export default mount(App, { target: document.getElementById("app")! });
