use tauri::{Manager, Runtime};

#[cfg(target_os = "macos")]
use tauri::window::{Effect, EffectState, EffectsBuilder};

fn apply_vibrancy<R: Runtime>(window: &tauri::WebviewWindow<R>) {
    #[cfg(target_os = "macos")]
    {
        let effects = EffectsBuilder::new()
            .effect(Effect::HudWindow)
            .state(EffectState::Active)
            .build();
        let _ = window.set_effects(effects);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = window;
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                apply_vibrancy(&window);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
