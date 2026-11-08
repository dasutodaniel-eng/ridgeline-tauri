import { settingsModal } from './settings.js';
import { $, S, api, audio, cur } from './state.js';
import { debounce, fmt, setFill } from './util.js';
import { savePlayback } from './store.js';
import { dislikeTrack } from './taste.js';
import { setTheme } from './theme.js';
import { toggleFav } from './library.js';
import { closeMenu, modalEl } from './overlays.js';
import { goBack, goFwd, openView } from './nav.js';
import { syncLikes } from './account.js';
import { openLoose } from './queue.js';
import { welcomeApi } from './welcome.js';
import { moreLikeThis } from './line.js';
import { applyVolume, bumpVolume, next, prev, repeatBtn, seek, setRepeat, setShuffle, shuffleBtn, toggle, vol } from './player.js';
import { hideAmbient, showAmbient } from './ambient.js';

$('#btnBack').onclick = goBack;
$('#btnFwd').onclick = goFwd;

setInterval(() => syncLikes(false), 10 * 60 * 1000);

$('#btnPlay').onclick = toggle;
$('#btnNext').onclick = () => next(false);
$('#btnPrev').onclick = prev;
$('#pheart').onclick = () => { if (cur()) toggleFav(cur()); };
$('#pdislike').onclick = () => { if (cur()) dislikeTrack(cur()); };
$('#pmore').onclick = () => { if (cur()) moreLikeThis(cur()); };
$('#btnQueue').onclick = () => openView({ type: 'queue' });

shuffleBtn.onclick = () => setShuffle(!S.shuffle);
repeatBtn.onclick = () => setRepeat({ off: 'all', all: 'one', one: 'off' }[S.repeat]);

seek.addEventListener('input', () => { S.seeking = true; setFill(seek); if (audio.duration) $('#tCur').textContent = fmt((seek.value / 1000) * audio.duration); });
seek.addEventListener('change', () => { if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration; S.seeking = false; seek.blur(); });

vol.addEventListener('input', () => { S.volume = vol.value / 100; S.muted = S.volume === 0; applyVolume(); savePlayback(); });
vol.addEventListener('change', () => vol.blur());
$('#btnMute').onclick = () => { S.muted = !S.muted; applyVolume(); savePlayback(); };
$('#btnMin').onclick = () => api.win('min');
$('#btnMax').onclick = () => api.win('max');
$('#btnClose').onclick = () => api.win('close');

const searchInput = $('#search');
const runSearch = debounce(() => {
  const q = searchInput.value.trim();
  if (!q) { if (S.view.type === 'search') openView({ type: 'home' }); return; }
  if (/^https?:\/\/(www\.|m\.|on\.)?soundcloud\.com\//i.test(q)) { openView({ type: 'sc-link', url: q }); return; }
  openView({ type: 'search', q });
}, 350);
searchInput.addEventListener('input', runSearch);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { searchInput.value = ''; searchInput.blur(); runSearch(); } });

let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; document.body.classList.add('dragging'); });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging');
  openLoose([...e.dataTransfer.files].map((f) => api.pathFor(f)).filter(Boolean), false);
});

document.addEventListener('keydown', (e) => {
  if (document.body.classList.contains('welcome')) {
    const tg0 = e.target;
    if (tg0 && tg0.tagName === 'INPUT' && tg0.type !== 'range') return;
    if (e.key === 'Enter' && welcomeApi) { e.preventDefault(); welcomeApi.next(); }
    else if (e.key === 'ArrowLeft' && welcomeApi) { e.preventDefault(); welcomeApi.back(); }
    return;
  }
  if (document.body.classList.contains('ambient')) {
    e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyF') api.win('full');
    else if (e.code === 'KeyA' || e.code === 'Escape') hideAmbient();
    else if (e.code === 'Space') toggle();
    else if (e.code === 'KeyN') next(false);
    else if (e.code === 'KeyP') prev();
    else if (e.code === 'ArrowUp') bumpVolume(0.05);
    else if (e.code === 'ArrowDown') bumpVolume(-0.05);
    else hideAmbient();
    return;
  }
  if (e.key === 'Escape') {
    if (modalEl.classList.contains('open')) { modalEl.onmousedown({ target: modalEl }); return; }
    closeMenu();
  }
  if (e.altKey && e.code === 'ArrowLeft') { e.preventDefault(); return goBack(); }
  if (e.altKey && e.code === 'ArrowRight') { e.preventDefault(); return goFwd(); }
  if (e.metaKey && !e.ctrlKey && !e.altKey) {   // macOS: ⌘F, ⌘[, ⌘], ⌘,
    if (e.code === 'KeyF') { e.preventDefault(); searchInput.focus(); }
    else if (e.code === 'BracketLeft') { e.preventDefault(); goBack(); }
    else if (e.code === 'BracketRight') { e.preventDefault(); goFwd(); }
    else if (e.code === 'Comma') { e.preventDefault(); settingsModal(); }
    return;
  }
  if (e.ctrlKey || e.altKey) { if (e.ctrlKey && e.code === 'KeyF') { e.preventDefault(); searchInput.focus(); } return; }
  if (modalEl.classList.contains('open')) return;
  const tg = e.target;
  if (tg && tg.tagName === 'INPUT' && tg.type !== 'range') return;
  const map = {
    Space: toggle,
    ArrowRight: () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5); },
    ArrowLeft: () => { audio.currentTime = Math.max(0, audio.currentTime - 5); },
    ArrowUp: () => bumpVolume(0.05),
    ArrowDown: () => bumpVolume(-0.05),
    KeyN: () => next(false), KeyP: prev,
    KeyS: () => setShuffle(!S.shuffle),
    KeyR: () => repeatBtn.click(),
    KeyM: () => $('#btnMute').click(),
    KeyQ: () => $('#btnQueue').click(),
    KeyL: () => openView({ type: 'line' }),
    KeyA: () => showAmbient('manual'),
    KeyT: () => setTheme(S.cfg.theme === 'geo' ? 'depth' : 'geo')
  };
  if (map[e.code]) { e.preventDefault(); if (document.activeElement) document.activeElement.blur(); map[e.code](); }
});

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  ms.setActionHandler('play', toggle);
  ms.setActionHandler('pause', () => audio.pause());
  ms.setActionHandler('previoustrack', prev);
  ms.setActionHandler('nexttrack', () => next(false));
  ms.setActionHandler('seekto', (d) => { audio.currentTime = d.seekTime; });
}
api.onOpen((paths) => openLoose(paths, true));
