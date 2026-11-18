import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: {
    target: "chrome110", // WebView2 é Chromium atual
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
});
