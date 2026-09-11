// Keep the native shell intentionally small: capabilities live in the local
// runtime and the React interface, while Tauri provides the secure window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ciel_lib::run()
}
