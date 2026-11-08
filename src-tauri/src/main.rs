#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod fsx;
mod meta;
mod net;
mod protocols;
mod sc;
mod store;
mod ym;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

// Состояние приложения: одно общее хранилище, как Electron main.js
pub struct App {
    pub handle: std::sync::OnceLock<AppHandle>,
    pub data_dir: PathBuf,
    pub launch: Mutex<Vec<String>>,
}
static APP: App = App {
    handle: std::sync::OnceLock::new(),
    data_dir: PathBuf::new(),
    launch: Mutex::new(Vec::new()),
};

impl App {
    fn data(&self) -> &PathBuf {
        &self.data_dir
    }
}

// папка данных — та же, что у Electron-версии, чтобы библиотека продолжила жить
fn resolve_data_dir() -> PathBuf {
    let base = dirs::data_dir().expect("не найдена папка данных %APPDATA%");
    let old = base.join("Dasuto Player");
    if old.exists() { old } else { base.join("Ridgeline") }
}

fn audio_from_argv() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|a| !a.starts_with("--") && fsx::is_audio(a) && std::path::Path::new(a).exists())
        .collect()
}

fn main() {
    let data_dir = resolve_data_dir();
    let launch = audio_from_argv();
    let app = App {
        handle: std::sync::OnceLock::new(),
        launch: Mutex::new(launch),
        data_dir,
    };

    tauri::Builder::default()
        .manage(app)
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                if w.is_minimized().unwrap_or(true) { let _ = w.unminimize(); }
                let _ = w.set_focus();
                let files: Vec<String> = argv
                    .iter()
                    .filter(|a| !a.starts_with("--") && fsx::is_audio(a) && std::path::Path::new(*a).exists())
                    .cloned()
                    .collect();
                if !files.is_empty() {
                    use tauri::Emitter;
                    let _ = w.emit("ridgeline:open", files);
                }
            }
        }))
        .invoke_handler(tauri::generate_handler![
            launch_paths,
            store_load,
            store_save,
            fs_expand,
            dialog_files,
            dialog_folder,
            meta_describe,
            meta_cover,
            win_control,
            ym_status,
            ym_login,
            ym_set_token,
            ym_logout,
            ym_likes,
            ym_playlists,
            ym_playlist,
            ym_search,
            ym_like,
            ym_artist,
            ym_album,
            ym_similar,
            ym_url,
            sc_search,
            sc_charts,
            sc_resolve,
            sc_artist,
            sc_url
        ])
        .register_asynchronous_uri_scheme_protocol("media", |_ctx, req, responder| {
            tauri::async_runtime::spawn(async move {
                let r = protocols::serve_local(req).await.unwrap_or_else(protocols::err_response);
                responder.respond(r);
            });
        })
        .register_asynchronous_uri_scheme_protocol("scproxy", |_ctx, req, responder| {
            tauri::async_runtime::spawn(async move {
                let r = protocols::serve_sc(req).await.unwrap_or_else(protocols::err_response);
                responder.respond(r);
            });
        })
        .setup(|app| {
            let _ = APP.handle.set(app.handle().clone());
            sc::set_data_dir(APP.data());
            ym::init(APP.data());
            // macOS: рамка как в Electron (hiddenInset ≈ Overlay) — на Windows это поле игнорируется
            #[cfg(target_os = "macos")]
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_decorations(true);
                let _ = w.set_title_bar_style(tauri::utils::TitleBarStyle::Overlay);
            }
            if let Ok(mut l) = APP.launch.lock() {
                let mut extra = audio_from_argv();
                if !extra.is_empty() { l.append(&mut extra); }
            }
            // перетаскивание файлов в окно: Tauri перехватывает дропы сам, DOM их не видит
            if let Some(w) = app.get_webview_window("main") {
                use tauri::{DragDropEvent, WindowEvent};
                let handle = app.handle().clone();
                w.on_window_event(move |e| {
                    if let WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = e {
                        let files: Vec<String> = paths
                            .iter()
                            .map(|p| p.to_string_lossy().into_owned())
                            .filter(|p| fsx::is_audio(p))
                            .collect();
                        if !files.is_empty() {
                            use tauri::Emitter;
                            let _ = handle.emit("ridgeline:open", files);
                        }
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("ошибка запуска Ridgeline");
}

// ---------- команды ----------

#[tauri::command]
fn launch_paths(state: tauri::State<App>) -> Vec<String> {
    state.launch.lock().unwrap_or_else(|e| e.into_inner()).drain(..).collect()
}

#[tauri::command]
async fn store_load(name: String, state: tauri::State<'_, App>) -> Result<Option<serde_json::Value>, String> {
    if !store::allowed(&name) {
        return Ok(None);
    }
    Ok(store::load(state.data(), &name).await)
}

#[tauri::command]
async fn store_save(name: String, data: serde_json::Value, state: tauri::State<'_, App>) -> Result<(), String> {
    if !store::allowed(&name) {
        return Ok(());
    }
    store::save(state.data(), &name, &data).await
}

#[derive(serde::Serialize)]
pub struct FileInfo {
    path: String,
    name: String,
}

#[tauri::command]
async fn fs_expand(paths: Vec<String>) -> Result<Vec<FileInfo>, String> {
    fsx::expand(paths).await
}

#[tauri::command]
async fn dialog_files() -> Result<Vec<String>, String> {
    let picked = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Выбери музыку")
            .add_filter("Аудио", &["mp3", "flac", "ogg", "opus", "wav", "m4a", "aac"])
            .pick_files()
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(picked.unwrap_or_default().into_iter().map(|p| p.to_string_lossy().into_owned()).collect())
}

#[tauri::command]
async fn dialog_folder() -> Result<Vec<String>, String> {
    let picked = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Выбери папку с музыкой")
            .pick_folder()
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(picked.map(|p| vec![p.to_string_lossy().into_owned()]).unwrap_or_default())
}

#[derive(serde::Serialize)]
pub struct TrackMeta {
    path: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    duration: f64,
    no: Option<u32>,
    genre: Option<String>,
}

#[tauri::command]
async fn meta_describe(paths: Vec<String>) -> Result<Vec<TrackMeta>, String> {
    let metas = tauri::async_runtime::spawn_blocking(move || paths.iter().map(|p| meta::describe(p)).collect::<Vec<_>>())
        .await
        .map_err(|e| e.to_string())?;
    Ok(metas)
}

#[tauri::command]
async fn meta_cover(path: String) -> Result<Option<String>, String> {
    let out = tauri::async_runtime::spawn_blocking(move || meta::cover(&path))
        .await
        .map_err(|e| e.to_string())?;
    Ok(out)
}

#[tauri::command]
async fn win_control(action: String, app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        match action.as_str() {
            "min" => w.minimize().map_err(err_str)?,
            "max" => {
                if w.is_maximized().map_err(err_str)? { w.unmaximize().map_err(err_str)?; } else { w.maximize().map_err(err_str)?; }
            }
            "close" => w.close().map_err(err_str)?,
            "full" => {
                let on = w.is_fullscreen().map_err(err_str)?;
                w.set_fullscreen(!on).map_err(err_str)?;
            }
            _ => {}
        }
    }
    Ok(())
}

fn err_str(e: impl std::fmt::Display) -> String {
    e.to_string()
}

// ---------- Яндекс ----------

#[tauri::command]
async fn ym_status() -> Result<serde_json::Value, String> { ym::status().await }

#[tauri::command]
async fn ym_login(app: tauri::AppHandle) -> Result<serde_json::Value, String> { ym::login(app).await }

#[tauri::command]
async fn ym_set_token(token: String, sign_key: Option<String>) -> Result<serde_json::Value, String> {
    ym::set_token(&token, sign_key.as_deref()).await
}

#[tauri::command]
async fn ym_logout() -> Result<serde_json::Value, String> { ym::logout().await }

#[tauri::command]
async fn ym_likes() -> Result<serde_json::Value, String> { ym::likes().await }

#[tauri::command]
async fn ym_playlists() -> Result<serde_json::Value, String> { ym::playlists().await }

#[tauri::command]
async fn ym_playlist(uid: i64, kind: i64) -> Result<serde_json::Value, String> { ym::playlist(uid, kind).await }

#[tauri::command]
async fn ym_search(q: String) -> Result<serde_json::Value, String> { ym::search(&q).await }

#[tauri::command]
async fn ym_like(ids: Vec<String>, on: bool) -> Result<serde_json::Value, String> { ym::like(&ids, on).await }

#[tauri::command]
async fn ym_artist(id: String) -> Result<serde_json::Value, String> { ym::artist(&id).await }

#[tauri::command]
async fn ym_album(id: String) -> Result<serde_json::Value, String> { ym::album(&id).await }

#[tauri::command]
async fn ym_similar(id: String) -> Result<serde_json::Value, String> { ym::similar(&id).await }

#[tauri::command]
async fn ym_url(id: String) -> Result<serde_json::Value, String> { ym::get_url(&id).await }

// ---------- SoundCloud ----------

#[tauri::command]
async fn sc_search(q: String) -> Result<serde_json::Value, String> { sc::search(&q).await }

#[tauri::command]
async fn sc_charts() -> Result<serde_json::Value, String> { sc::charts().await }

#[tauri::command]
async fn sc_resolve(url: String) -> Result<serde_json::Value, String> { sc::resolve(&url).await }

#[tauri::command]
async fn sc_artist(id: String) -> Result<serde_json::Value, String> { sc::artist(&id).await }

#[tauri::command]
async fn sc_url(id: String) -> Result<serde_json::Value, String> { sc::get_url(&id).await }
