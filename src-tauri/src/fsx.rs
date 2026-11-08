// Файловый слой: расширение аудио, «числовая» сортировка как Intl.Collator, обход папок.
use crate::FileInfo;
use std::cmp::Ordering;
use std::path::{Path, PathBuf};

pub const AUDIO_EXT: &[&str] = &[".mp3", ".flac", ".ogg", ".opus", ".wav", ".m4a", ".aac"];

pub fn is_audio(p: &str) -> bool {
    let lower = p.to_lowercase();
    Path::new(&lower)
        .extension()
        .map(|e| {
            let mut dot = String::from(".");
            dot.push_str(&e.to_string_lossy());
            AUDIO_EXT.contains(&dot.as_str())
        })
        .unwrap_or(false)
}

// Approximation of numeric comparisons of Intl.Collator: digit runs are compared as numbers, the rest case-insensitively.
fn nat_cmp(a: &str, b: &str) -> Ordering {
    let (mut ai, mut bi) = (0, 0);
    let (ab, bb) = (a.as_bytes(), b.as_bytes());
    while ai < ab.len() && bi < bb.len() {
        let ad = ab[ai].is_ascii_digit();
        let bd = bb[bi].is_ascii_digit();
        if ad && bd {
            let ae = ab[ai..].iter().position(|c| !c.is_ascii_digit()).map(|i| ai + i).unwrap_or(ab.len());
            let be = bb[bi..].iter().position(|c| !c.is_ascii_digit()).map(|i| bi + i).unwrap_or(bb.len());
            let (an, bn) = (&a[ai..ae], &b[bi..be]);
            // Compare numerically: first by length (no leading zeros are rare, but it works either way).
            let a0 = an.trim_start_matches('0');
            let b0 = bn.trim_start_matches('0');
            let ord = a0.len().cmp(&b0.len()).then(a0.cmp(b0));
            if ord != Ordering::Equal { return ord; }
            ai = ae;
            bi = be;
        } else {
            let ac = ab[ai].to_ascii_lowercase();
            let bc = bb[bi].to_ascii_lowercase();
            if ac != bc { return ac.cmp(&bc); }
            ai += 1;
            bi += 1;
        }
    }
    (ab.len() - ai).cmp(&(bb.len() - bi))
}

fn natural_sort(names: &mut [(String, PathBuf)]) {
    names.sort_by(|(a, _), (b, _)| nat_cmp(a, b));
}

async fn walk(dir: &Path, out: &mut Vec<String>) {
    let mut stack = vec![dir.to_path_buf()];
    while let Some(d) = stack.pop() {
        let mut rd = match tokio::fs::read_dir(&d).await {
            Ok(rd) => rd,
            Err(_) => continue,
        };
        let mut names = Vec::new();
        while let Ok(Some(e)) = rd.next_entry().await {
            names.push((e.file_name().to_string_lossy().into_owned(), e.path()));
        }
        natural_sort(&mut names);
        for (_, path) in names {
            if path.is_dir() {
                stack.push(path);
            } else {
                let s = path.to_string_lossy().into_owned();
                if is_audio(&s) {
                    out.push(s);
                }
            }
        }
    }
}

pub async fn expand(paths: Vec<String>) -> Result<Vec<FileInfo>, String> {
    let mut files: Vec<String> = Vec::new();
    for p in &paths {
        match tokio::fs::metadata(p).await {
            Ok(m) => {
                if m.is_dir() {
                    walk(Path::new(p), &mut files).await;
                } else if is_audio(p) {
                    files.push(p.clone());
                }
            }
            Err(_) => continue, // file doesn't exist — skip it
        }
    }
    files.dedup();
    Ok(files
        .into_iter()
        .map(|f| {
            let stem = Path::new(&f)
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default();
            FileInfo { path: f, name: stem }
        })
        .collect())
}
