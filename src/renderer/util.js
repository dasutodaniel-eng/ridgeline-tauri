import { $ } from './state.js';

export const h = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
export const svg = (inner) => `<svg viewBox="0 0 24 24">${inner}</svg>`;
export const IC = {
  play: '<path d="M8 5.5v13L19 12z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  note: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  folder: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2.5h8A1.5 1.5 0 0 1 20.5 10v7.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  list: '<path d="M4 7h12M4 12h12M4 17h7M18 14.5v5M15.5 17h5"/>',
  queue: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  ym: '<circle cx="12" cy="12" r="8"/><path d="M10 8.5v7l5.5-3.5z"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9a4.5 4.5 0 0 1 .5 9z"/>',
  home: '<path d="M4 11l8-6.5 8 6.5v8a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  wave: '<path d="M2.5 12c2-7 4-7 6 0s4 7 6 0 4-7 7 0"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  shuffle: '<path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 3.8c1.1 1.6 2.3 2.6 4.3 2.6H21M3 17h3.5c2 0 3.2-1 4.3-2.6M13.2 10.6c1.1-1.6 2.3-2.6 4.3-2.6H21M18.5 5.5L21 8l-2.5 2.5M18.5 13.5L21 16l-2.5 2.5"/>'
};

export const uid = () => Math.random().toString(36).slice(2, 9);

export const fmt = (t) => {
  if (!isFinite(t) || t < 0) t = 0;
  const hh = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
  const p = (n) => String(n).padStart(2, '0');
  return hh ? `${hh}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
};
export const fmtLong = (sec) => {
  const hh = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return hh ? `${hh} ч ${m} мин` : `${m} мин`;
};
export const plural = (n, f) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return f[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b >= 2 && b <= 4 ? 1 : 2];
};
export const tracksWord = (n) => `${n} ${plural(n, ['трек', 'трека', 'треков'])}`;
export const setFill = (input) => {
  input.style.setProperty('--p', ((input.value - input.min) / (input.max - input.min)) * 100 + '%');
};
export const errText = (e) => (e && e.message ? e.message : String(e));
export let toastTimer;
export const toast = (msg) => {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
};
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const hash = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
export const rngSeed = (seed) => {
  let a = hash(String(seed));
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
export const dayKey = () => new Date().toISOString().slice(0, 10);
export const shuffled = (arr, rng) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const sampleWeighted = (items, weights, n, rng) =>
  items.map((it, i) => ({ it, k: Math.pow(rng(), 1 / Math.max(0.01, weights[i])) })).sort((a, b) => b.k - a.k).slice(0, n).map((x) => x.it);

export const coverUrl = (t, size) => (t && t.cover ? t.cover.replace('%%', `${size}x${size}`) : null);
export const slim = (t) => ({
  id: t.id, src: t.src, path: t.path, url: t.url, ymId: t.ymId, scId: t.scId, albumId: t.albumId || null,
  title: t.title, artist: t.artist, artists: t.artists || undefined, album: t.album,
  duration: t.duration, no: t.no || null, genre: t.genre, cover: t.cover || null
});

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const nkey = (x) => String(x || '').toLowerCase().trim();
