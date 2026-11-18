; Visual do instalador (NSIS) no estilo do app.
; Este arquivo é incluído pelo modelo do Tauri antes das páginas do MUI,
; então estas definições valem para todas as telas.

; Fundo escuro e texto claro nas telas de boas-vindas/conclusão e no cabeçalho.
!define MUI_BGCOLOR "0B0B10"
!define MUI_TEXTCOLOR "FFFFFF"
; Log da instalação em tema escuro.
!define MUI_INSTFILESPAGE_COLORS "F5F5F8 15151C"
!define MUI_INSTFILESPAGE_PROGRESSBAR "smooth"
; Imagem do cabeçalho alinhada à esquerda, sem esticar.
!define MUI_HEADERIMAGE_BITMAP_NOSTRETCH
!define MUI_HEADERIMAGE_UNBITMAP_NOSTRETCH
