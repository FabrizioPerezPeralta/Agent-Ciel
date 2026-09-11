#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

#[tauri::command]
fn toggle_compact_window(window: tauri::Window) -> Result<(), String> {
    let is_decorated = window.is_decorated().map_err(|error| error.to_string())?;
    window.set_decorations(!is_decorated).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_always_on_top(window: tauri::Window, enabled: bool) -> Result<(), String> {
    window.set_always_on_top(enabled).map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            toggle_compact_window,
            set_always_on_top
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ciel");
}
