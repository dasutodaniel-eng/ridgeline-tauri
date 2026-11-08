import { $, S, api, audio, cur } from './state.js';
import { artBg } from './art.js';
import { coverUrl, errText, fmt, setFill, toast } from './util.js';
import { lastPb, savePlayback } from './store.js';
import { isFav } from './data.js';
import { recordPlay, recordSkip } from './stats.js';
import { learn } from './taste.js';
import { albumNode, artistsNode } from './uikit.js';
import { updateTint } from './theme.js';
import { renderMain } from './pages.js';
import { markCurrent, softRefresh } from './rows.js';
import { fillLine } from './line.js';
import { updateAmbientText } from './ambient.js';
import { sourceOf } from './sources/index.js';

export let coverToken = 0, playToken = 0, curCoverUrl = null;
export function setPCover(url) {
  const c = $('#pcover');
  c.style.background = '';
  c.style.backgroundImage = url ? `url("${url}")` : '';
  if (!url && cur()) c.style.background = artBg(cur().album || cur().artist || cur().title);
  c.classList.toggle('has-img', !!url);
  curCoverUrl = url;
  updateTint(cur(), url);
  updateMediaSession();
}
export function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const t = cur();
  navigator.mediaSession.metadata = t
    ? new MediaMetadata({ title: t.title, artist: t.artist || '', album: t.album || '', artwork: curCoverUrl ? [{ src: curCoverUrl }] : [] })
    : null;
}
export function syncPlayerHeart() { const t = cur(); $('#pheart').classList.toggle('on', !!t && isFav(t)); }
export function updateNowPlaying() {
  const t = cur();
  $('#ptitle').textContent = t ? t.title : 'Ничего не играет';
  const pa = $('#partist'); pa.textContent = '';
  if (t) {
    pa.append(artistsNode(t));
    if (t.album) { pa.append(document.createTextNode(' — ')); pa.append(albumNode(t)); }
  } else pa.textContent = 'Выбери трек в библиотеке';
  document.title = t ? `${t.artist ? t.artist + ' — ' : ''}${t.title}` : 'Ridgeline';
  syncPlayerHeart(); updateMediaSession(); updateAmbientText();
}
export async function loadCover(t) {
  const tok = ++coverToken;
  setPCover(null);
  if (t.cover) { setPCover(coverUrl(t, 400)); return; }
  if (t.src !== 'local') return;
  if (t._cover === undefined) t._cover = await api.cover(t.path);
  if (tok === coverToken && t._cover) setPCover(t._cover);
}

let hls = null;
export const stopHls = () => { if (hls) { hls.destroy(); hls = null; } };

export async function playIndex(i, { autoplay = true, at = 0 } = {}) {
  const t = S.queue[i];
  if (!t) return;
  S.idx = i;
  S.rec = { id: t.id, counted: false };
  const token = ++playToken;
  updateNowPlaying(); markCurrent(); loadCover(t);
  $('#tCur').textContent = fmt(at); $('#tDur').textContent = fmt(t.duration);
  if (S.line.active && S.queue.length - 1 - i < 4) fillLine(10);
  if (sourceOf(t).lazy && !autoplay) { S.needsLoad = true; S.resumeAt = at; audio.removeAttribute('src'); return; }
  S.needsLoad = false;
  const source = sourceOf(t);
  let url = t.url, useHls = false;
  if (source.lazy) {
    try {
      const r = await source.resolve(t);
      if (token !== playToken) return;
      url = r.url; useHls = !!r.hls;
      if (r.preview) toast(`${source.label}: доступен только фрагмент трека (нужна подписка)`);
    } catch (e) {
      if (token !== playToken) return;
      toast(`${source.label}: ${errText(e)}`); handleFail(); return;
    }
  }
  stopHls();
  if (useHls) {
    const Hls = window.Hls;
    if (!Hls || !Hls.isSupported()) { toast(`${source.label}: этот поток не поддерживается`); handleFail(); return; }
    hls = new Hls({ enableWorker: false });
    hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { toast(`${source.label}: ошибка потока`); handleFail(); } });
    hls.loadSource(url); hls.attachMedia(audio);
  } else audio.src = url;
  if (at) audio.addEventListener('loadedmetadata', () => { audio.currentTime = at; }, { once: true });
  if (autoplay) audio.play().catch(() => {});
  savePlayback();
  if (S.view.type === 'line') renderMain();
}
export const handleFail = () => {
  S.errStreak++;
  if (S.errStreak < 3 && S.queue.length > 1) setTimeout(() => next(true), 700);
  else { S.errStreak = 0; document.body.classList.remove('playing'); }
};
export const toggle = () => {
  if (S.idx < 0) return S.queue.length ? playIndex(0) : toast('Выбери трек в библиотеке');
  if (S.needsLoad) return playIndex(S.idx, { at: S.resumeAt });
  audio.paused ? audio.play().catch(() => {}) : audio.pause();
};
export const next = (auto = false) => {
  if (!S.queue.length) return;
  const t = cur();
  if (!auto && t && S.rec.id === t.id && !S.rec.counted && audio.currentTime > 0.5 && audio.currentTime < 15) { recordSkip(t); learn(t, 'skip'); }
  if (auto && S.repeat === 'one') { audio.currentTime = 0; audio.play(); return; }
  let n;
  if (S.shuffle && S.queue.length > 1 && !S.line.active) {
    do { n = Math.floor(Math.random() * S.queue.length); } while (n === S.idx);
  } else {
    n = S.idx + 1;
    if (n >= S.queue.length) {
      if (S.repeat === 'all' || !auto) n = 0;
      else { audio.pause(); audio.currentTime = 0; return; }
    }
  }
  if (S.idx >= 0) S.history.push(S.idx);
  playIndex(n);
};
export const prev = () => {
  if (!S.queue.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  const p = S.history.length ? S.history.pop() : (S.idx - 1 < 0 ? S.queue.length - 1 : S.idx - 1);
  playIndex(p);
};

audio.addEventListener('play', () => document.body.classList.add('playing'));
audio.addEventListener('playing', () => { S.errStreak = 0; });
audio.addEventListener('pause', () => { document.body.classList.remove('playing'); savePlayback(); });
audio.addEventListener('ended', () => { if (cur()) learn(cur(), 'done'); next(true); });
audio.addEventListener('loadedmetadata', () => {
  $('#tDur').textContent = fmt(audio.duration);
  const t = cur();
  if (t && isFinite(audio.duration) && Math.abs((t.duration || 0) - audio.duration) > 2 && t.src === 'local') { t.duration = audio.duration; softRefresh(); }
});
audio.addEventListener('timeupdate', () => {
  $('#tCur').textContent = fmt(audio.currentTime);
  if (!S.seeking && audio.duration) { $('#seek').value = (audio.currentTime / audio.duration) * 1000; setFill($('#seek')); }
  const t = cur();
  if (t && !S.rec.counted && S.rec.id === t.id && audio.duration && audio.currentTime >= Math.min(20, audio.duration * 0.5)) { S.rec.counted = true; recordPlay(t); }
  if (document.body.classList.contains('ambient') && audio.duration) $('.am-bar i').style.width = (audio.currentTime / audio.duration) * 100 + '%';
  if (Date.now() - lastPb > 5000) savePlayback();
});
audio.addEventListener('error', () => {
  if (!audio.getAttribute('src')) return;
  toast(`Не удалось воспроизвести: ${cur() ? cur().title : 'файл'}`);
  handleFail();
});

export const shuffleBtn = $('#btnShuffle'), repeatBtn = $('#btnRepeat');
export function setShuffle(v) { S.shuffle = v; shuffleBtn.classList.toggle('on', v); savePlayback(); }
export function setRepeat(v) { S.repeat = v; repeatBtn.dataset.mode = v; repeatBtn.classList.toggle('on', v !== 'off'); savePlayback(); }
export const seek = $('#seek');
export const vol = $('#volume');
export const applyVolume = () => { audio.volume = S.volume; audio.muted = S.muted; vol.value = S.muted ? 0 : S.volume * 100; setFill(vol); };
export const bumpVolume = (d) => { S.muted = false; S.volume = Math.min(1, Math.max(0, S.volume + d)); applyVolume(); savePlayback(); };
