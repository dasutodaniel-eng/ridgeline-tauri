export const api = window.api;
export const $ = (s) => document.querySelector(s);
export const audio = $('#audio');
export const S = {
  lib: { folders: [], playlists: [], favorites: [] },
  view: { type: 'home' }, nav: { stack: [{ type: 'home' }], pos: 0 },
  queue: [], idx: -1, shuffle: false, repeat: 'off', history: [],
  volume: 0.8, muted: false, seeking: false,
  ym: { connected: false, login: '', plus: false, playlists: [] },
  errStreak: 0, needsLoad: false, resumeAt: 0,
  stats: { counts: {}, recent: [], explore: 0.35, ambientAuto: true },
  line: { active: false, busy: false, seed: null, seedFills: 0, mode: 'all' },
  cfg: { theme: 'depth', matte: 30, syncLikes: true, scSearch: true },
  taste: { done: false, skipped: false, artists: {}, genres: {}, tracks: {}, names: {}, lang: 'any' },
  seen: new Set(), sync: { busy: false, last: 0, msg: '' },
  rec: { id: null, counted: false }
};
export const cur = () => S.queue[S.idx];
// Общее изменяемое состояние времени выполнения (нельзя присваивать импортированные let из других модулей).
export const R = { likesCache: null };
