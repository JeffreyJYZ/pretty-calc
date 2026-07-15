mod calc;

use calc::{evaluate, format_number, AngleMode};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn calc_eval(expr: &str, angle: &str, ans: f64) -> String {
    let angle = AngleMode::from_str(angle).unwrap_or(AngleMode::Deg);
    match evaluate(expr, angle, ans) {
        Ok(v) => format_number(v),
        Err(e) => format!("__err__:{}", e.message()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![greet, calc_eval])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}