// Хранилище JSON: library, queue, playback, stats (аналог store:load/save из Electron).
use std::path::Path;

const STORES: &[&str] = &["library", "queue", "playback", "stats"];

pub fn allowed(name: &str) -> bool {
    STORES.contains(&name)
}

fn path_of(dir: &Path, name: &str) -> std::path::PathBuf {
    dir.join(format!("{name}.json"))
}

pub async fn load(dir: &Path, name: &str) -> Option<serde_json::Value> {
    if !allowed(name) {
        return None;
    }
    let raw = tokio::fs::read_to_string(path_of(dir, name)).await.ok()?;
    serde_json::from_str(&raw).ok()
}

pub async fn save(dir: &Path, name: &str, data: &serde_json::Value) -> Result<(), String> {
    if !allowed(name) {
        return Ok(());
    }
    let body = serde_json::to_string(data).map_err(|e| e.to_string())?;
    tokio::fs::write(path_of(dir, name), body).await.map_err(|e| e.to_string())
}
