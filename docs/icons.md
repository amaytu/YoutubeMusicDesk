# Ícones do app

Os ícones em `src-tauri/icons/` são gerados a partir de `src/assets/logo.svg`
(notas musicais ligadas pela metade formando um fone de ouvido).

Para regenerar com o Tauri CLI, exporte o SVG para um PNG 1024×1024 e rode:

```powershell
cargo tauri icon caminho\para\logo-1024.png
```
