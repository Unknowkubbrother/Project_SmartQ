// src-tauri/src/lib.rs
mod idcard_reader;
use std::thread;

// #[cfg(mobile)]
// #[tauri::mobile_entry_point]
// pub fn run(app_handle: idcard_reader::AppHandle) {
//     thread::spawn(move || {
//         let _ = idcard_reader::run_event_loop(app_handle);
//     });
// }

#[cfg(not(mobile))]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();
            thread::spawn(move || {
                if let Err(e) = idcard_reader::run_event_loop(app_handle) {
                    eprintln!("Error in card reader event loop: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
