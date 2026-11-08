// Теги через lofty (замена music-metadata из Electron-версии).
use crate::TrackMeta;

fn sniff_mime(data: &[u8]) -> &'static str {
    if data.starts_with(&[0xFF, 0xD8]) {
        "image/jpeg"
    } else if data.starts_with(&[0x89, b'P', b'N', b'G']) {
        "image/png"
    } else if data.starts_with(b"GIF") {
        "image/gif"
    } else if data.starts_with(b"BM") {
        "image/bmp"
    } else if data.len() >= 4 && (&data[..4] == b"II*\0" || &data[..4] == b"MM\0*") {
        "image/tiff"
    } else {
        "application/octet-stream"
    }
}

fn blank(path: &str) -> TrackMeta {
    TrackMeta {
        path: path.to_string(),
        title: None,
        artist: None,
        album: None,
        duration: 0.0,
        no: None,
        genre: None,
    }
}

fn parse(path: &str) -> Result<(Option<lofty::tag::Tag>, std::time::Duration), lofty::error::LoftyError> {
    use lofty::file::{AudioFile, TaggedFileExt};
    use lofty::probe::Probe;
    let tagged = Probe::open(path)?.read()?;
    let dur = tagged.properties().duration();
    Ok((tagged.primary_tag().or_else(|| tagged.first_tag()).cloned(), dur))
}

pub fn describe(path: &str) -> TrackMeta {
    use lofty::prelude::*;
    let (tag_opt, dur) = match parse(path) {
        Ok(v) => v,
        Err(_) => return blank(path),
    };
    let tag = match tag_opt {
        Some(tag) => tag,
        None => return TrackMeta {
            path: path.to_string(),
            title: None,
            artist: None,
            album: None,
            duration: dur.as_secs_f64(),
            no: None,
            genre: None,
        },
    };
    let s = |c: Option<std::borrow::Cow<str>>| c.map(|c| c.into_owned()).filter(|s| !s.trim().is_empty());
    TrackMeta {
        path: path.to_string(),
        title: s(tag.title()),
        artist: s(tag.artist()),
        album: s(tag.album()),
        duration: dur.as_secs_f64(),
        no: tag.track(),
        genre: s(tag.genre()),
    }
}

pub fn cover(path: &str) -> Option<String> {
    use base64::Engine;
    use lofty::prelude::*;
    use lofty::probe::Probe;
    let tagged = Probe::open(path).ok()?.read().ok()?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag())?;
    for pic in tag.pictures().iter().rev() {
        let data = pic.data();
        if data.is_empty() {
            continue;
        }
        return Some(format!(
            "data:{};base64,{}",
            sniff_mime(data),
            base64::engine::general_purpose::STANDARD.encode(data)
        ));
    }
    None
}
