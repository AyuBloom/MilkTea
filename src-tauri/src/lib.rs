use std::sync::Mutex;
use sysinfo::{get_current_pid, ProcessesToUpdate, System};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

struct SystemState {
    sys: Mutex<System>,
}

#[tauri::command]
fn get_memory_usage(state: tauri::State<'_, SystemState>) -> Result<u64, String> {
    let mut sys = state.sys.lock().map_err(|e| e.to_string())?;

    // Get current process ID
    let pid = get_current_pid().map_err(|e| e.to_string())?;

    // Refresh only the current process memory
    sys.refresh_processes(ProcessesToUpdate::Some(&[pid]));

    // Extract app memory
    let app_memory = sys.process(pid).map(|p| p.memory()).unwrap_or(0);

    Ok(app_memory)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SystemState {
            sys: Mutex::new(System::new()),
        })
        .plugin(tauri_plugin_svelte::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_macos_fps::init())
        // .plugin(tauri_plugin_websocket::init())
        .invoke_handler(tauri::generate_handler![get_memory_usage])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
