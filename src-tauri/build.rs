fn main() {
    // Comandos do app passam pelo ACL: cada janela só chama o que sua capability permite.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "ytm",
            "player_cmd",
            "show_login",
            "sign_out",
            "bridge_reply",
            "bridge_event",
            "island_hitbox",
            "show_main",
            "synced_lyrics",
            "translate_lines",
        ]),
    ))
    .expect("falha no tauri-build");
}
