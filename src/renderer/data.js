import { S } from './state.js';

export const isFav = (t) => S.lib.favorites.some((f) => f.id === t.id);
export const allLocal = () => {
  const m = new Map();
  for (const f of S.lib.folders) for (const t of f.tracks) m.set(t.id, t);
  return [...m.values()];
};
export const findPlaylist = (id) => S.lib.playlists.find((p) => p.id === id);
export const findFolder = (id) => S.lib.folders.find((f) => f.id === id);
export const artistList = (t) => {
  if (t.artists && t.artists.length) return t.artists;
  return t.artist ? t.artist.split(/,\s*/).filter(Boolean).map((name) => ({ id: null, name })) : [];
};
export const trackPool = () => {
  const m = new Map();
  for (const p of S.lib.playlists) for (const t of p.tracks) m.set(t.id, t);
  for (const t of S.lib.favorites) m.set(t.id, t);
  for (const t of allLocal()) m.set(t.id, t);
  return [...m.values()];
};
export const byAlbumOrder = (a, b) =>
  (a.album || '').localeCompare(b.album || '') || ((a.no || 1e9) - (b.no || 1e9)) || (a.title || '').localeCompare(b.title || '');

export const artistTracks = (name) => {
  const n = name.toLowerCase();
  return trackPool().filter((t) => artistList(t).some((a) => a.name.toLowerCase() === n));
};
export const groupAlbums = (tracks) => {
  const m = new Map();
  for (const t of tracks) {
    if (!t.album) continue;
    const first = (artistList(t)[0] || {}).name || '';
    const k = t.album + '|' + first;
    let e = m.get(k);
    if (!e) { e = { name: t.album, artist: first, tracks: [] }; m.set(k, e); }
    e.tracks.push(t);
  }
  for (const e of m.values()) e.tracks.sort((a, b) => (a.no || 1e9) - (b.no || 1e9) || (a.title || '').localeCompare(b.title || ''));
  return [...m.values()];
};
