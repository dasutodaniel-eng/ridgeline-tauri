// Неофициальный клиент Яндекс Музыки (порт src/yandex.js из Electron-версии).
// Приватный API: может сломаться без предупреждения.
use crate::net;
use base64::Engine;
use hmac::Mac;
use serde_json::{json, Value};
use std::path::Path;
use std::sync::{Mutex, OnceLock};

const API: &str = "https://api.music.yandex.net";
const CLIENT_ID: &str = "23cabbbdc6cd418abb4b39c32c41195d"; // клиент официального приложения Яндекс Музыки
const DEFAULT_SIGN_KEY: &str = "p93jhgh689SBReK6ghtw62"; // ключ подписи download-info (можно заменить в окне входа)
const MD5_SALT: &str = "XGRlBW9FXlekgbPrRHuSiA";

#[derive(Default)]
struct Cfg {
    token: Option<String>,
    uid: Option<i64>,
    login: String,
    plus: bool,
    sign_key: Option<String>,
}

static CFG: Mutex<Cfg> = Mutex::new(Cfg {
    token: None,
    uid: None,
    login: String::new(),
    plus: false,
    sign_key: None,
});
static DATA_DIR: OnceLock<std::path::PathBuf> = OnceLock::new();

// ---------- конфиг в ym.json (в Electron токен шифруется DPAPI — формат сохранён) ----------

fn cfg_path() -> std::path::PathBuf {
    DATA_DIR.get().map(|d| d.join("ym.json")).expect("data dir")
}

#[derive(serde::Serialize)]
struct Persisted {
    #[serde(skip_serializing_if = "Option::is_none")]
    uid: Option<i64>,
    #[serde(skip_serializing_if = "str::is_empty")]
    login: String,
    plus: bool,
    #[serde(rename = "signKey", skip_serializing_if = "Option::is_none")]
    sign_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    token: Option<String>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    enc: bool,
}

fn persist() {
    let cfg = CFG.lock().unwrap();
    let mut out = Persisted {
        uid: cfg.uid,
        login: cfg.login.clone(),
        plus: cfg.plus,
        sign_key: cfg.sign_key.clone(),
        token: None,
        enc: false,
    };
    if let Some(token) = &cfg.token {
        #[cfg(windows)]
        if let Some(blob) = dpapi_protect(token.as_bytes()) {
            out.token = Some(base64::engine::general_purpose::STANDARD.encode(blob));
            out.enc = true;
        } else {
            out.token = Some(token.clone());
        }
        #[cfg(not(windows))]
        {
            out.token = Some(token.clone());
        }
    }
    let _ = std::fs::write(cfg_path(), serde_json::to_string(&out).unwrap_or_default());
}

pub fn init(dir: &Path) {
    let _ = DATA_DIR.set(dir.to_path_buf());
    let raw = match std::fs::read_to_string(cfg_path()) {
        Ok(raw) => raw,
        Err(_) => return, // первого запуска ещё нет
    };
    let v: Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return,
    };
    let token = v
        .get("token")
        .and_then(|t| t.as_str())
        .map(|t| t.to_string())
        .filter(|t| !t.is_empty());
    let token = match (v.get("enc").and_then(|e| e.as_bool()).unwrap_or(false), token) {
        // токен из Electron зашифрован DPAPI — читаем как есть
        (true, Some(b64)) => {
            #[cfg(windows)]
            {
                base64::engine::general_purpose::STANDARD
                    .decode(b64)
                    .ok()
                    .and_then(|blob| dpapi_unprotect(&blob))
                    .and_then(|b| String::from_utf8(b).ok())
            }
            #[cfg(not(windows))]
            {
                None // формат safeStorage macOS не восстанавливаем: нужен повторный вход
            }
        }
        (false, Some(t)) => Some(t),
        _ => None,
    };
    let mut cfg = CFG.lock().unwrap();
    cfg.token = token;
    cfg.uid = v.get("uid").and_then(|u| u.as_i64());
    cfg.login = v.get("login").and_then(|l| l.as_str()).unwrap_or_default().to_string();
    cfg.plus = v.get("plus").and_then(|p| p.as_bool()).unwrap_or(false);
    cfg.sign_key = v.get("signKey").and_then(|k| k.as_str()).map(|s| s.to_string()).filter(|s| !s.is_empty());
}

#[cfg(windows)]
fn dpapi_protect(data: &[u8]) -> Option<Vec<u8>> {
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };
    unsafe {
        let mut input = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };
        let mut out = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
        let ok = CryptProtectData(
            &mut input,
            std::ptr::null(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut out,
        );
        if ok == 0 {
            return None;
        }
        let v = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
        #[cfg(windows)]
        windows_sys::Win32::Foundation::LocalFree(out.pbData as _);
        Some(v)
    }
}

#[cfg(windows)]
fn dpapi_unprotect(data: &[u8]) -> Option<Vec<u8>> {
    use windows_sys::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };
    unsafe {
        let mut input = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };
        let mut out = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
        let ok = CryptUnprotectData(
            &mut input,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut out,
        );
        if ok == 0 {
            return None;
        }
        let v = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
        windows_sys::Win32::Foundation::LocalFree(out.pbData as _);
        Some(v)
    }
}

// ---------- HTTP ----------

async fn call(
    path: &str,
    method: &'static str,
    query: &[(&str, &str)],
    form: Option<Vec<(String, String)>>,
) -> Result<Value, String> {
    let token = CFG.lock().unwrap().token.clone();
    let token = token.ok_or("Яндекс Музыка не подключена")?;
    let mut url = format!("{API}{path}");
    if !query.is_empty() {
        url.push('?');
        url.push_str(
            &query
                .iter()
                .map(|(k, v)| format!("{}={}", urlencoding::encode(k), urlencoding::encode(v)))
                .collect::<Vec<_>>()
                .join("&"),
        );
    }
    let mut req = net::api_client()
        .request(
            reqwest::Method::from_bytes(method.as_bytes()).unwrap_or(reqwest::Method::GET),
            &url,
        )
        .header("Authorization", format!("OAuth {token}"))
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24023621")
        .header("Accept-Language", "ru");
    if let Some(form) = form {
        req = req.form(&form);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if status != 200 {
        if status == 401 {
            return Err("Токен недействителен, войди заново".into());
        }
        let json: Result<Value, _> = serde_json::from_str(&text);
        let msg = json
            .ok()
            .and_then(|j| j.pointer("/error").map(|e| {
                e.get("message").or_else(|| e.get("name")).and_then(|m| m.as_str()).unwrap_or("").to_string()
            }))
            .filter(|m| !m.is_empty())
            .unwrap_or_else(|| text.chars().take(120).collect());
        return Err(format!("Яндекс ответил {status}: {msg}"));
    }
    let json: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    Ok(json.get("result").cloned().unwrap_or(json))
}

// ---------- оболочка треков ----------

fn map_track(t: &Value) -> Option<Value> {
    let id = t.get("id")?;
    let ym_id = match id {
        Value::Number(n) => Some(n.to_string()),
        Value::String(s) if !s.is_empty() => Some(s.clone()),
        _ => None,
    }?;
    let version = t.get("version").and_then(|v| v.as_str()).unwrap_or("");
    Some(json!({
        "id": format!("y:{ym_id}"),
        "src": "ym",
        "ymId": ym_id,
        "title": match (t.get("title").and_then(|v| v.as_str()).unwrap_or(""), version) {
            ("", _) => String::new(),
            (title, "") => title.to_string(),
            (title, v) => format!("{title} ({v})"),
        },
        "artist": (t.get("artists").and_then(|a| a.as_array())).map(|a| a.iter().filter_map(|x| x.get("name").and_then(|n| n.as_str())).collect::<Vec<_>>().join(", ")).unwrap_or_default(),
        "album": t.pointer("/albums/0/title").and_then(|v| v.as_str()).unwrap_or(""),
        "albumId": t.pointer("/albums/0/id").map(|v| v.to_string().replace('"', "")),
        "genre": t.pointer("/albums/0/genre").and_then(|v| v.as_str()),
        "artists": t.get("artists").and_then(|a| a.as_array()).map(|a| a.iter().map(|x| json!({
            "id": x.get("id").map(|v| v.to_string().replace('"', "")),
            "name": x.get("name").and_then(|n| n.as_str()).unwrap_or("")
        })).collect::<Vec<_>>()).unwrap_or_default(),
        "duration": (t.get("durationMs").and_then(|v| v.as_f64()).unwrap_or(0.0)) / 1000.0,
        "cover": t.get("coverUri").and_then(|v| v.as_str()).map(|u| format!("https://{u}"))
    }))
}

async fn fetch_tracks(ids: &[String]) -> Result<Value, String> {
    let mut out: Vec<Value> = Vec::new();
    for chunk in ids.chunks(100) {
        let r = call(
            "/tracks",
            "POST",
            &[],
            Some(vec![
                ("track-ids".to_string(), chunk.join(",")),
                ("with-positions".to_string(), "False".to_string()),
            ]),
        )
        .await?;
        if let Some(arr) = r.as_array() {
            for t in arr {
                if let Some(m) = map_track(t) {
                    out.push(m);
                }
            }
        }
    }
    Ok(Value::Array(out))
}

// ---------- статус / токен ----------

pub async fn status() -> Result<Value, String> {
    let connected = CFG.lock().unwrap().token.is_some();
    if !connected {
        return Ok(json!({ "connected": false }));
    }
    match call("/account/status", "GET", &[], None).await {
        Ok(r) => {
            let uid = r.pointer("/account/uid").and_then(|u| u.as_i64());
            let login = r
                .pointer("/account/login")
                .or_else(|| r.pointer("/account/displayName"))
                .and_then(|l| l.as_str())
                .unwrap_or("")
                .to_string();
            let plus = r.pointer("/plus/hasPlus").and_then(|p| p.as_bool()).unwrap_or(false);
            {
                let mut cfg = CFG.lock().unwrap();
                cfg.uid = uid;
                cfg.login = login.clone();
                cfg.plus = plus;
            }
            persist();
            Ok(json!({ "connected": true, "login": login, "plus": plus }))
        }
        Err(e) => Ok(json!({ "connected": false, "error": e })),
    }
}

pub async fn set_token(token: &str, sign_key: Option<&str>) -> Result<Value, String> {
    let token = token.trim();
    {
        let mut cfg = CFG.lock().unwrap();
        cfg.token = if token.is_empty() { None } else { Some(token.to_string()) };
        if let Some(k) = sign_key {
            let k = k.trim();
            cfg.sign_key = if k.is_empty() { None } else { Some(k.to_string()) };
        }
    }
    let st = status().await?;
    if st.get("connected").and_then(|c| c.as_bool()) != Some(true) {
        CFG.lock().unwrap().token = None;
    }
    persist();
    Ok(st)
}

pub async fn logout() -> Result<Value, String> {
    let sign_key = CFG.lock().unwrap().sign_key.clone();
    *CFG.lock().unwrap() = Cfg { token: None, uid: None, login: String::new(), plus: false, sign_key };
    persist();
    Ok(json!({ "connected": false }))
}

// ---------- окно входа (oauth.yandex.ru, токен в URL) ----------

fn extract_token(url: &str) -> Option<String> {
    let at = url.find("access_token=")? + "access_token=".len();
    let rest = &url[at..];
    let end = rest.find('&').unwrap_or(rest.len());
    urlencoding::decode(&rest[..end]).ok().map(|s| s.into_owned())
}

pub async fn login(app: tauri::AppHandle) -> Result<Value, String> {
    use tauri::Manager;
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    let url: reqwest::Url = format!("https://oauth.yandex.ru/authorize?response_type=token&client_id={CLIENT_ID}")
        .parse::<reqwest::Url>()
        .map_err(|e| e.to_string())?;
    let win = tauri::WebviewWindowBuilder::new(&app, "ym-login", tauri::WebviewUrl::External(url))
        .title("Вход в Яндекс")
        .inner_size(520.0, 720.0)
        .on_navigation(move |u| {
            if let Some(token) = extract_token(u.as_str()) {
                let _ = tx.send(token);
                return false; // останавливаем навигацию: токен уже пойман
            }
            true
        })
        .build()
        .map_err(|e| e.to_string())?;

    let start = std::time::Instant::now();
    let token = loop {
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        if let Ok(t) = rx.try_recv() {
            break Some(t);
        }
        if app.get_webview_window("ym-login").is_none() {
            break None; // окно закрыли
        }
        if start.elapsed() > std::time::Duration::from_secs(600) {
            break None;
        }
    };
    let _ = win;
    let _ = app.get_webview_window("ym-login").map(|w| w.close());
    match token {
        None => Ok(json!({ "connected": false, "error": "Окно входа закрыто, токен не получен" })),
        Some(t) => set_token(&t, None).await,
    }
}

// ---------- библиотека ----------

pub async fn likes() -> Result<Value, String> {
    let uid = CFG.lock().unwrap().uid;
    let uid = uid.ok_or("Яндекс Музыка не подключена")?;
    let r = call(&format!("/users/{uid}/likes/tracks"), "GET", &[], None).await?;
    let ids: Vec<String> = r
        .pointer("/library/tracks")
        .and_then(|t| t.as_array())
        .map(|a| a.iter().filter_map(|t| t.get("id").map(|i| i.to_string().replace('"', ""))).collect())
        .unwrap_or_default();
    fetch_tracks(&ids).await
}

pub async fn playlists() -> Result<Value, String> {
    let uid = CFG.lock().unwrap().uid;
    let uid = uid.ok_or("Яндекс Музыка не подключена")?;
    let r = call(&format!("/users/{uid}/playlists/list"), "GET", &[], None).await?;
    Ok(Value::Array(
        r.as_array()
            .map(|a| {
                a.iter()
                    .map(|p| {
                        json!({
                            "kind": p.get("kind").map(|k| k.as_i64().unwrap_or(0)).unwrap_or(0),
                            "uid": p.get("uid").and_then(|k| k.as_i64()).unwrap_or(uid),
                            "title": p.get("title").and_then(|t| t.as_str()).unwrap_or(""),
                            "count": p.get("trackCount").and_then(|c| c.as_i64()).unwrap_or(0)
                        })
                    })
                    .collect()
            })
            .unwrap_or_default(),
    ))
}

pub async fn playlist(uid: i64, kind: i64) -> Result<Value, String> {
    let r = call(&format!("/users/{uid}/playlists/{kind}"), "GET", &[], None).await?;
    let ids: Vec<String> = r
        .get("tracks")
        .and_then(|t| t.as_array())
        .map(|a| a.iter().filter_map(|t| t.get("id").map(|i| i.to_string().replace('"', ""))).collect())
        .unwrap_or_default();
    fetch_tracks(&ids).await
}

pub async fn search(text: &str) -> Result<Value, String> {
    let r = call(
        "/search",
        "GET",
        &[("text", text), ("type", "track"), ("page", "0"), ("nocorrect", "false")],
        None,
    )
    .await?;
    Ok(Value::Array(
        r.pointer("/tracks/results")
            .and_then(|t| t.as_array())
            .map(|a| a.iter().filter_map(map_track).collect())
            .unwrap_or_default(),
    ))
}

fn cover_tpl(uri: Option<&str>) -> Option<String> {
    uri.map(|u| format!("https://{u}"))
}

pub async fn artist(id: &str) -> Result<Value, String> {
    let r = call(&format!("/artists/{id}/brief-info"), "GET", &[], None).await?;
    let a = r.get("artist").cloned().unwrap_or(Value::Null);
    let tracks: Vec<Value> = r
        .get("popularTracks")
        .or_else(|| r.get("tracks"))
        .and_then(|t| t.as_array())
        .map(|arr| arr.iter().filter_map(map_track).collect())
        .unwrap_or_default();
    let first_cover = tracks.first().and_then(|t| t.get("cover").cloned()).unwrap_or(Value::Null);
    Ok(json!({
        "id": a.get("id").map(|v| v.to_string().replace('"', "")).unwrap_or_else(|| id.to_string()),
        "name": a.get("name").and_then(|n| n.as_str()).unwrap_or(""),
        "cover": (cover_tpl(a.pointer("/cover/uri").and_then(|c| c.as_str()))).or(first_cover.as_str().map(|s| s.to_string())),
        "popular": tracks,
        "albums": r.get("albums").and_then(|al| al.as_array()).map(|arr| arr.iter().map(|al| json!({
            "id": al.get("id").map(|v| v.to_string().replace('"', "")).unwrap_or_default(),
            "title": al.get("title").and_then(|t| t.as_str()).unwrap_or(""),
            "year": al.get("year").and_then(|t| t.as_i64()),
            "cover": cover_tpl(al.get("coverUri").and_then(|c| c.as_str())),
            "count": al.get("trackCount").and_then(|c| c.as_i64()).unwrap_or(0)
        })).collect::<Vec<_>>()).unwrap_or_default(),
        "similar": r.get("similarArtists").and_then(|sa| sa.as_array()).map(|arr| arr.iter().map(|x| json!({
            "id": x.get("id").map(|v| v.to_string().replace('"', "")).unwrap_or_default(),
            "name": x.get("name").and_then(|n| n.as_str()).unwrap_or(""),
            "cover": cover_tpl(x.pointer("/cover/uri").and_then(|c| c.as_str()))
        })).collect::<Vec<_>>()).unwrap_or_default()
    }))
}

pub async fn album(id: &str) -> Result<Value, String> {
    let r = call(&format!("/albums/{id}/with-tracks"), "GET", &[], None).await?;
    let tracks: Vec<Value> = r
        .get("volumes")
        .and_then(|v| v.as_array())
        .map(|vols| vols.iter().flat_map(|v| v.as_array().map(|a| a.clone()).unwrap_or_default()).collect::<Vec<_>>())
        .unwrap_or_default()
        .iter()
        .filter_map(map_track)
        .collect();
    Ok(json!({
        "id": r.get("id").map(|v| v.to_string().replace('"', "")).unwrap_or_else(|| id.to_string()),
        "title": r.get("title").and_then(|t| t.as_str()).unwrap_or(""),
        "year": r.get("year").and_then(|t| t.as_i64()),
        "cover": cover_tpl(r.get("coverUri").and_then(|c| c.as_str())),
        "artists": r.get("artists").and_then(|ar| ar.as_array()).map(|arr| arr.iter().map(|a| json!({
            "id": a.get("id").map(|v| v.to_string().replace('"', "")),
            "name": a.get("name").and_then(|n| n.as_str()).unwrap_or("")
        })).collect::<Vec<_>>()).unwrap_or_default(),
        "tracks": tracks
    }))
}

pub async fn similar(id: &str) -> Result<Value, String> {
    let r = call(&format!("/tracks/{id}/similar"), "GET", &[], None).await?;
    Ok(Value::Array(
        r.get("similarTracks")
            .and_then(|t| t.as_array())
            .map(|a| a.iter().filter_map(map_track).collect())
            .unwrap_or_default(),
    ))
}

pub async fn like(ids: &[String], on: bool) -> Result<Value, String> {
    if ids.is_empty() {
        return Ok(json!(true));
    }
    let uid = CFG.lock().unwrap().uid;
    let uid = uid.ok_or("Яндекс Музыка не подключена")?;
    for chunk in ids.chunks(100) {
        call(
            &format!("/users/{uid}/likes/tracks/{}", if on { "add-multiple" } else { "remove" }),
            "POST",
            &[],
            Some(vec![("track-ids".to_string(), chunk.join(","))]),
        )
        .await?;
    }
    Ok(json!(true))
}

pub async fn get_url(id: &str) -> Result<Value, String> {
    let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
    let key = CFG.lock().unwrap().sign_key.clone().unwrap_or_else(|| DEFAULT_SIGN_KEY.to_string());

    type HmacSha256 = hmac::Hmac<sha2::Sha256>;
    let mut mac = HmacSha256::new_from_slice(key.as_bytes()).map_err(|e| e.to_string())?;
    mac.update(format!("{id}{ts}").as_bytes());
    let sign = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());

    let list = call(
        &format!("/tracks/{id}/download-info"),
        "GET",
        &[("can_use_streaming", "true"), ("ts", &ts.to_string()), ("sign", &sign)],
        None,
    )
    .await?;
    let items = list.as_array().ok_or("Яндекс не отдал ссылки на трек")?;
    if items.is_empty() {
        return Err("Яндекс не отдал ссылки на трек".into());
    }

    let real: Vec<&Value> = items.iter().filter(|i| i.get("preview").and_then(|p| p.as_bool()) != Some(true)).collect();
    let pool: Vec<&Value> = if real.is_empty() { items.iter().collect() } else { real };
    let mut mp3: Vec<&Value> = pool.iter().copied().filter(|i| i.get("codec").and_then(|c| c.as_str()) == Some("mp3")).collect();
    mp3.sort_by_key(|i| std::cmp::Reverse(i.get("bitrateInKbps").and_then(|b| b.as_i64()).unwrap_or(0)));
    let pick: &Value = mp3.first().copied().unwrap_or(pool[0]);

    let info_url = pick
        .get("downloadInfoUrl")
        .and_then(|u| u.as_str())
        .ok_or("Яндекс не отдал ссылки на трек")?
        .to_string();
    let host0 = reqwest::Url::parse(&info_url).map_err(|e| e.to_string())?.host_str().unwrap_or("").to_string();
    let mut req = net::api_client().get(&info_url);
    if host0.ends_with("music.yandex.net") {
        let token = CFG.lock().unwrap().token.clone().unwrap_or_default();
        req = req
            .header("Authorization", format!("OAuth {token}"))
            .header("X-Yandex-Music-Client", "YandexMusicAndroid/24023621")
            .header("Accept-Language", "ru");
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let body = res.text().await.map_err(|e| e.to_string())?;
    if status != 200 {
        return Err(format!("Не удалось получить ссылку ({status})"));
    }

    let info: Value = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(_) => {
            // старый XML-ответ: достаём поля тегами
            let g = |tag: &str| {
                let open = format!("<{tag}>");
                let close = format!("</{tag}>");
                let at = body.find(&open)? + open.len();
                let rest = &body[at..];
                let end = rest.find(&close)?;
                Some(rest[..end].to_string())
            };
            let path = g("path").ok_or("Неожиданный ответ Яндекса при получении ссылки")?;
            let s = g("s").ok_or("Неожиданный ответ Яндекса при получении ссылки")?;
            let ts = g("ts").unwrap_or_else(|| ts.to_string());
            json!({ "host": g("host"), "path": path, "ts": ts, "s": s })
        }
    };
    let host = info.get("host").and_then(|h| h.as_str()).ok_or("Неожиданный ответ Яндекса при получении ссылки")?;
    let path = info.get("path").and_then(|p| p.as_str()).ok_or("Неожиданный ответ Яндекса при получении ссылки")?;
    let t_s = info.get("s").and_then(|s| s.as_str()).ok_or("Неочевидный ответ Яндекса при получении ссылки")?;
    let its = info.get("ts").and_then(|t| t.as_str()).unwrap_or(&ts.to_string()).to_string();

    use md5::Digest;
    let digest = md5::Md5::digest(format!("{MD5_SALT}{}", path[1..].to_string() + t_s).as_bytes());
    let md5 = format!("{digest:x}");

    Ok(json!({
        "url": format!("https://{host}/get-mp3/{md5}/{its}{path}"),
        "codec": pick.get("codec").and_then(|c| c.as_str()).unwrap_or(""),
        "bitrate": pick.get("bitrateInKbps").and_then(|b| b.as_i64()).unwrap_or(0),
        "preview": pick.get("preview").and_then(|p| p.as_bool()).unwrap_or(false)
    }))
}
