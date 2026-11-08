// Неофициальный клиент SoundCloud (порт src/soundcloud.js). Публичный api-v2 сайта:
// client_id соскребается со страницы, кэшируется в sc.json. Может сломаться, если сайт изменится.
use crate::net;
use serde_json::{json, Value};
use std::sync::Mutex;

const API: &str = "https://api-v2.soundcloud.com";
const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

static CLIENT_ID: Mutex<Option<String>> = Mutex::new(None);
static DATA_DIR: std::sync::OnceLock<std::path::PathBuf> = std::sync::OnceLock::new();

pub fn set_data_dir(d: &std::path::Path) {
    let _ = DATA_DIR.set(d.to_path_buf());
}

fn load_id() -> Option<String> {
    let raw = std::fs::read_to_string(DATA_DIR.get()?.join("sc.json")).ok()?;
    serde_json::from_str::<Value>(&raw).ok()?.get("clientId")?.as_str().map(|s| s.to_string())
}

fn save_id(id: &str) {
    if let Some(dir) = DATA_DIR.get() {
        let _ = std::fs::write(dir.join("sc.json"), json!({ "clientId": id }).to_string());
    }
}

async fn fetch_text(url: &str, timeout: std::time::Duration) -> Result<(u16, String), String> {
    let res = net::api_client()
        .get(url)
        .header("User-Agent", UA)
        .timeout(timeout)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok((status, text))
}

// между src="…" для ссылок на ассеты
fn script_urls(html: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = html;
    while let Some(at) = rest.find("<script") {
        rest = &rest[at..];
        let end = match rest.find('>') {
            Some(e) => e,
            None => break,
        };
        let tag = &rest[..end];
        if let Some(mark) = tag.find("https://a-v2.sndcdn.com/assets/") {
            let tail = &tag[mark..];
            if let Some(stop) = tail.find('"') {
                out.push(tail[..stop].to_string());
            }
        }
        rest = &rest[end.min(1)..]; // сдвигаем минимум на один символ
    }
    out
}

// тонко: "client_id":"<32 символов>"
fn client_id_from(js: &str) -> Option<String> {
    let mut rest = js;
    while let Some(at) = rest.find("\"client_id\"") {
        let after = &rest[at + "\"client_id\"".len()..];
        let start = after.find('"')?;
        let seg = &after[start + 1..];
        let end = seg.find('"')?;
        let v = &seg[..end];
        if v.chars().count() == 32 && v.chars().all(|c| c.is_ascii_alphanumeric()) {
            return Some(v.to_string());
        }
        rest = after; // продолжаем искать дальше по тексту
    }
    None
}

async fn scrape_client_id() -> Result<String, String> {
    let (status, home) = fetch_text("https://soundcloud.com/", std::time::Duration::from_secs(20)).await?;
    if status != 200 {
        return Err(format!("soundcloud.com ответил {status}"));
    }
    let mut scripts = script_urls(&home);
    scripts.reverse();
    for url in scripts {
        if let Ok((200, js)) = fetch_text(&url, std::time::Duration::from_secs(20)).await {
            if let Some(id) = client_id_from(&js) {
                return Ok(id);
            }
        }
    }
    Err("Не удалось получить ключ SoundCloud (сайт изменился)".into())
}

async fn ensure_id(force: bool) -> Result<String, String> {
    if force {
        *CLIENT_ID.lock().unwrap() = None;
    }
    {
        let current = CLIENT_ID.lock().unwrap().clone();
        if let Some(id) = current {
            return Ok(id);
        }
    }
    if let Some(id) = load_id() {
        *CLIENT_ID.lock().unwrap() = Some(id.clone());
        return Ok(id);
    }
    let id = scrape_client_id().await?;
    *CLIENT_ID.lock().unwrap() = Some(id.clone());
    save_id(&id);
    Ok(id)
}

async fn call(path: &str, query: &[(&str, &str)], retry: bool) -> Result<Value, String> {
    let id = ensure_id(false).await?;
    let mut qs = query
        .iter()
        .map(|(k, v)| format!("{}={}", urlencoding::encode(k), urlencoding::encode(v)))
        .collect::<Vec<_>>();
    qs.push(format!("client_id={id}"));
    let url = format!("{API}/{path}?{}", qs.join("&"));
    let (status, text) = fetch_text(&url, std::time::Duration::from_secs(20)).await?;
    if (status == 401 || status == 403) && retry {
        let _ = ensure_id(true).await;
        return Box::pin(call(path, query, false)).await;
    }
    if status != 200 {
        return Err(format!("SoundCloud ответил {status}"));
    }
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

fn art(t: &Value) -> Option<String> {
    let u = t
        .get("artwork_url")
        .and_then(|v| v.as_str())
        .or_else(|| t.pointer("/user/avatar_url").and_then(|v| v.as_str()))?;
    Some(u.replace("-large.", "-t500x500."))
}

fn map_track(t: &Value) -> Option<Value> {
    if t.get("id").is_none() {
        return None;
    }
    if let Some(kind) = t.get("kind").and_then(|k| k.as_str()) {
        if kind != "track" {
            return None;
        }
    }
    if t.get("access").and_then(|a| a.as_str()) == Some("blocked")
        || t.get("policy").and_then(|p| p.as_str()) == Some("BLOCK")
    {
        return None;
    }
    let id = match t.get("id") {
        Some(Value::Number(n)) => n.to_string(),
        Some(Value::String(s)) => s.clone(),
        _ => return None,
    };
    let user = t.get("user").cloned().unwrap_or(Value::Null);
    let pm = t.get("publisher_metadata").cloned().unwrap_or(Value::Null);
    let user_id = user.get("id").map(|v| v.to_string().replace('"', ""));
    let artist = pm
        .get("artist")
        .and_then(|a| a.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| user.get("username").and_then(|u| u.as_str()).unwrap_or("").to_string());
    let dur = t
        .get("full_duration")
        .and_then(|d| d.as_f64())
        .or_else(|| t.get("duration").and_then(|d| d.as_f64()))
        .unwrap_or(0.0);
    Some(json!({
        "id": format!("s:{id}"),
        "src": "sc",
        "scId": id,
        "title": t.get("title").and_then(|t| t.as_str()).unwrap_or(""),
        "artist": artist,
        "artists": [{ "id": user_id, "name": artist, "src": "sc" }],
        "album": pm.get("album_title").and_then(|a| a.as_str()).unwrap_or(""),
        "albumId": Value::Null,
        "duration": dur / 1000.0,
        "genre": t.get("genre").and_then(|g| g.as_str()),
        "cover": art(t)
    }))
}

fn map_list(arr: Option<Vec<Value>>) -> Vec<Value> {
    arr.unwrap_or_default().iter().filter_map(map_track).collect()
}

async fn fill_tracks(items: Option<Vec<Value>>) -> Result<Vec<Value>, String> {
    let mut got: std::collections::HashMap<i64, Value> = std::collections::HashMap::new();
    let mut stubs: Vec<i64> = Vec::new();
    for t in items.unwrap_or_default() {
        if let Some(id) = t.get("id").and_then(|i| i.as_i64()) {
            if t.get("title").is_some() {
                got.insert(id, t);
            } else {
                stubs.push(id);
            }
        }
    }
    for chunk in stubs.chunks(50) {
        let ids = chunk.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
        let filled = call("tracks", &[("ids", &ids)], true).await?;
        if let Some(arr) = filled.as_array() {
            for t in arr {
                if let Some(id) = t.get("id").and_then(|i| i.as_i64()) {
                    got.entry(id).or_insert_with(|| t.clone());
                }
            }
        }
    }
    Ok(stubs
        .iter()
        .filter_map(|id| got.get(id).cloned())
        .filter_map(|t| map_track(&t))
        .collect())
}

pub async fn search(q: &str) -> Result<Value, String> {
    let r = call("search/tracks", &[("q", q), ("limit", "30")], true).await?;
    Ok(Value::Array(map_list(r.get("collection").and_then(|c| c.as_array()).cloned())))
}

pub async fn charts() -> Result<Value, String> {
    let r = call(
        "charts",
        &[("kind", "trending"), ("genre", "soundcloud:genres:all-music"), ("limit", "40")],
        true,
    )
    .await?;
    let tracks = r
        .get("collection")
        .and_then(|c| c.as_array())
        .map(|arr| arr.iter().filter_map(|c| c.get("track").cloned()).collect::<Vec<_>>());
    Ok(Value::Array(map_list(tracks)))
}

pub async fn resolve(url: &str) -> Result<Value, String> {
    let o = call("resolve", &[("url", url)], true).await?;
    let title = |key: &str| o.get(key).and_then(|t| t.as_str()).unwrap_or("").to_string();
    match o.get("kind").and_then(|k| k.as_str()).unwrap_or("") {
        "track" => Ok(json!({ "title": title("title"), "cover": art(&o), "tracks": map_list(Some(vec![o.clone()])) })),
        "playlist" => {
            let t = o.get("tracks").and_then(|t| t.as_array()).cloned();
            Ok(json!({ "title": title("title"), "cover": art(&o), "tracks": fill_tracks(t).await? }))
        }
        "user" => {
            let id = o.get("id").and_then(|i| i.as_i64()).unwrap_or(0);
            let t = call(&format!("users/{id}/tracks"), &[("limit", "50")], true).await?;
            Ok(json!({
                "title": title("username"),
                "cover": art(&o),
                "tracks": map_list(t.get("collection").and_then(|c| c.as_array()).cloned())
            }))
        }
        _ => Err("Не удалось разобрать ссылку SoundCloud".into()),
    }
}

pub async fn artist(id: &str) -> Result<Value, String> {
    let u_url = format!("users/{id}");
    let top_url = format!("users/{id}/toptracks");
    let all_url = format!("users/{id}/tracks");
    let (u, top, all) = tokio::join!(
        call(&u_url, &[], true),
        call(&top_url, &[("limit", "10")], true),
        call(&all_url, &[("limit", "50")], true),
    );
    let u = u?;
    let all = all?;
    let top_ok = top.ok();
    let tracks = map_list(all.get("collection").and_then(|c| c.as_array()).cloned());
    let popular = top_ok
        .map(|t| map_list(t.get("collection").and_then(|c| c.as_array()).cloned()))
        .unwrap_or_default();
    let pop_used = if popular.is_empty() {
        tracks.iter().take(5).cloned().collect()
    } else {
        popular
    };
    Ok(json!({
        "id": id,
        "name": u.get("username").and_then(|t| t.as_str()).unwrap_or(""),
        "cover": art(&u),
        "popular": pop_used,
        "tracks": tracks
    }))
}

fn rank(x: &Value) -> i32 {
    let f = x.get("format").cloned().unwrap_or(Value::Null);
    let mime = f.get("mime_type").and_then(|m| m.as_str()).unwrap_or("");
    let protocol = f.get("protocol").and_then(|p| p.as_str()).unwrap_or("");
    if protocol == "progressive" && mime.contains("mpeg") {
        0
    } else if protocol == "hls" && mime.contains("mpeg") {
        1
    } else if protocol == "hls" && mime.contains("mp4") {
        2
    } else if protocol == "progressive" {
        3
    } else {
        9
    }
}

pub async fn get_url(id: &str) -> Result<Value, String> {
    let t = call(&format!("tracks/{id}"), &[], true).await?;
    let mut picks: Vec<&Value> = t
        .pointer("/media/transcodings")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter(|x| rank(x) < 9).collect::<Vec<_>>())
        .unwrap_or_default();
    picks.sort_by_key(|x| rank(x));
    let pick = picks
        .first()
        .ok_or("У трека нет доступного потока (закрытый или только для подписчиков)")?;

    let pick_url = pick
        .get("url")
        .and_then(|u| u.as_str())
        .ok_or("У трека нет доступного потока")?
        .to_string();
    let cid = ensure_id(false).await?;
    let sep = if pick_url.contains('?') { '&' } else { '?' };
    let mut final_url = format!("{pick_url}{sep}client_id={cid}");
    if let Some(auth) = t.get("track_authorization").and_then(|a| a.as_str()) {
        final_url.push_str(&format!("&track_authorization={auth}"));
    }
    let (status, body) = fetch_text(&final_url, std::time::Duration::from_secs(20)).await?;
    if status != 200 {
        return Err(format!("SoundCloud не дал ссылку на поток ({status})"));
    }
    let v: Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    let url = v.get("url").and_then(|u| u.as_str()).ok_or("SoundCloud не дал ссылку на поток")?;
    Ok(json!({
        "url": url,
        "hls": pick.pointer("/format/protocol").and_then(|p| p.as_str()) == Some("hls"),
        "preview": t.get("access").and_then(|a| a.as_str()) == Some("preview")
    }))
}
