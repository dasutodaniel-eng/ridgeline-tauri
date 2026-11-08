// Два URI-протокола вместо привязки Electron к file:// и подмены CORS-заголовков:
//   media://   — локальные файлы (Range, чтобы <audio> умел перемотку);
//   scproxy:// — https-стримы SoundCloud (манифест HLS и сегменты тянет Rust, CORS не нужен).
use base64::Engine;
use std::time::Duration;
use tauri::http::{header, HeaderValue, Request, Response, StatusCode};

pub type HttpResp = Response<Vec<u8>>;

pub fn err_response(msg: String) -> HttpResp {
    Response::builder()
        .status(StatusCode::INTERNAL_SERVER_ERROR)
        .body(msg.into_bytes())
        .unwrap()
}

// CORS открыт: страница живёт на tauri.localhost, а протокол — другой источник
fn base(status: StatusCode) -> tauri::http::response::Builder {
    Response::builder()
        .status(status)
        .header("access-control-allow-origin", "*")
        .header("access-control-allow-headers", "*")
        .header("access-control-allow-methods", "GET, OPTIONS")
}

fn parse_range(v: Option<&HeaderValue>, total: u64) -> Option<(u64, u64)> {
    let re = v?.to_str().ok()?.strip_prefix("bytes=")?;
    let (a, b) = re.split_once('-')?;
    let start = a.trim().parse::<u64>().ok()?;
    let end = if b.trim().is_empty() {
        total.saturating_sub(1)
    } else {
        b.trim().parse::<u64>().ok()?.min(total.saturating_sub(1))
    };
    if start > end || start >= total {
        return None;
    }
    Some((start, end))
}

const CHUNK: usize = 64 * 1024;

// -------- media:// — локальный файл --------

pub async fn serve_local(req: Request<Vec<u8>>) -> Result<HttpResp, String> {
    let enc = req.uri().path().trim_start_matches('/');
    let path = urlencoding::decode(enc).map_err(|e| e.to_string())?.into_owned();
    let f = tokio::fs::File::open(&path).await.map_err(|e| e.to_string())?;
    let total = f.metadata().await.map_err(|e| e.to_string())?.len();

    let mut f = f;
    let (status, start, end) = match parse_range(req.headers().get(header::RANGE), total) {
        Some((s, e)) => {
            use std::io::SeekFrom;
            use tokio::io::AsyncSeekExt;
            f.seek(SeekFrom::Start(s)).await.map_err(|e| e.to_string())?;
            (StatusCode::PARTIAL_CONTENT, s, e)
        }
        None => (StatusCode::OK, 0, total.saturating_sub(1)),
    };
    let len = end - start + 1;
    let mut out = Vec::with_capacity(len.min(32 * 1024 * 1024) as usize);
    use tokio::io::AsyncReadExt;
    let mut buf = vec![0u8; CHUNK];
    let mut remaining = len;
    while remaining > 0 {
        let want = usize::try_from(remaining).unwrap_or(CHUNK).min(CHUNK);
        let n = f.read(&mut buf[..want]).await.map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        out.extend_from_slice(&buf[..n]);
        remaining -= n as u64;
    }

    let mut rb = base(status)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_TYPE, HeaderValue::from_static("audio/mpeg"))
        .header(header::CONTENT_LENGTH, out.len());
    if status == StatusCode::PARTIAL_CONTENT {
        rb = rb.header(header::CONTENT_RANGE, format!("bytes {start}-{end}/{total}"));
    }
    rb.body(out).map_err(|e| e.to_string())
}

// -------- scproxy:// — удалённый стрим --------

pub async fn serve_sc(req: Request<Vec<u8>>) -> Result<HttpResp, String> {
    let enc = req.uri().path().trim_start_matches('/');
    let dec = urlencoding::decode(enc).map_err(|e| e.to_string())?;
    let url = String::from_utf8(
        base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(dec.as_bytes())
            .map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    let cli = crate::net::stream_client();
    let mut call = cli.get(&url);
    if let Some(r) = req.headers().get(header::RANGE).and_then(|v| v.to_str().ok()) {
        call = call.header(header::RANGE, r);
    }
    let resp = call
        .timeout(Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let mut rb = base(status).header(header::ACCEPT_RANGES, "bytes");
    for name in [header::CONTENT_TYPE, header::CONTENT_RANGE] {
        if let Some(v) = resp.headers().get(&name).cloned() {
            rb = rb.header(&name, v);
        }
    }
    let body = resp.bytes().await.map_err(|e| e.to_string())?;
    rb.header(header::CONTENT_LENGTH, body.len())
        .body(body.to_vec())
        .map_err(|e| e.to_string())
}
