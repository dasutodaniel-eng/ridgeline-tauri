import { S } from './state.js';
import { dayKey, nkey, rngSeed, sampleWeighted, shuffled, tracksWord } from './util.js';
import { allLocal, artistList, artistTracks, groupAlbums, isFav, trackPool } from './data.js';
import { artistPlays } from './stats.js';
import { genreLabel, tasteBlocked, trackGenre, trackScore } from './taste.js';
import { makeCard } from './uikit.js';
import { openView } from './nav.js';
import { startList } from './queue.js';

export const topArtists = (limit) => {
  const ap = artistPlays(), cnt = new Map();
  for (const t of trackPool()) for (const a of artistList(t)) {
    const k = a.name.toLowerCase();
    const e = cnt.get(k) || { name: a.name, n: 0, tracks: [] };
    e.n++; if (e.tracks.length < 4) e.tracks.push(t);
    cnt.set(k, e);
  }
  return [...cnt.values()].filter((e) => (S.taste.artists[nkey(e.name)] || 0) > -3)
    .map((e) => ({ ...e, score: e.n * 0.3 + (ap.get(e.name.toLowerCase()) || 0) + 2.5 * (S.taste.artists[nkey(e.name)] || 0) }))
    .sort((a, b) => b.score - a.score).slice(0, limit);
};
export const computeMix = (id) => {
  const pool = trackPool().filter((t) => !tasteBlocked(t)), rng = rngSeed(dayKey() + id), ap = artistPlays();
  if (id === 'daily') {
    const w = pool.map((t) => trackScore(t, 0.3, ap));
    return { title: 'Микс дня', sub: 'Свежая выборка на сегодня', tracks: sampleWeighted(pool, w, 40, rng) };
  }
  if (id === 'forgotten') {
    const now = Date.now();
    const t = pool.filter((x) => { const c = S.stats.counts[x.id]; return isFav(x) && (!c || now - c.last > 21 * 864e5); });
    return { title: 'Давно не слушал', sub: 'Любимое, до которого не доходили руки', tracks: shuffled(t, rng).slice(0, 50) };
  }
  if (id === 'top') {
    const t = Object.values(S.stats.counts).filter((c) => c.n > 0 && c.t).sort((a, b) => b.n - a.n).slice(0, 50).map((c) => c.t);
    return { title: 'Часто слушаешь', sub: 'По числу прослушиваний', tracks: t };
  }
  if (id === 'recent') {
    return { title: 'Недавно играло', sub: 'История прослушиваний', tracks: [...S.stats.recent].reverse().slice(0, 60) };
  }
  if (id === 'albumday') {
    const albums = groupAlbums(allLocal()).filter((a) => a.tracks.length >= 3);
    if (!albums.length) return { title: 'Альбом дня', sub: '', tracks: [] };
    const a = albums[Math.floor(rng() * albums.length)];
    return { title: a.name, sub: `Альбом дня · ${a.artist}`, tracks: a.tracks, album: a };
  }
  if (id.startsWith('genre:')) {
    const k = id.slice(6), t = pool.filter((x) => trackGenre(x) === k);
    return { title: genreLabel(k), sub: 'Подборка по жанру', tracks: sampleWeighted(t, t.map((x) => trackScore(x, 0.2)), 50, rng) };
  }
  if (id.startsWith('artist:')) {
    const name = id.slice(7);
    return { title: 'Микс: ' + name, sub: 'Собрано из твоей музыки', tracks: shuffled(artistTracks(name), rng).slice(0, 50) };
  }
  return { title: '', sub: '', tracks: [] };
};
export const mixCard = (id, accent) => {
  const m = computeMix(id);
  if (!m.tracks.length) return null;
  return makeCard({
    title: m.title, sub: m.sub || tracksWord(m.tracks.length), tracks: m.tracks, seed: m.title + (id === 'daily' ? dayKey() : ''), kind: id.split(':')[0],
    open: () => openView(m.album ? { type: 'album', name: m.album.name, artist: m.album.artist } : { type: 'mix', id }),
    play: () => startList(m.tracks, false)
  });
};
