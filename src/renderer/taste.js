import { S, cur } from './state.js';
import { clamp, nkey, toast } from './util.js';
import { saveStats } from './store.js';
import { artistList } from './data.js';
import { renderMain } from './pages.js';
import { adaptLine } from './line.js';
import { next } from './player.js';

export const GENRES = [
  ['hiphop', 'Хип-хоп и рэп', /rap|hip.?hop|рэп|хип.?хоп|trap|drill|grime/i],
  ['metal', 'Метал', /metal|метал|hardcore|deathcore/i],
  ['punk', 'Панк', /punk|панк/i],
  ['indie', 'Инди', /indie|инди|shoegaze|dream.?pop/i],
  ['alternative', 'Альтернатива', /alternative|альтернатив|\bemo\b|post.?rock|пост.?рок/i],
  ['rock', 'Рок', /rock|рок|grunge|гранж/i],
  ['electronic', 'Электроника', /electro|электрон|techno|house|trance|\bedm\b|dubstep|drum|dnb|idm|synth|dance|танц/i],
  ['ambient', 'Эмбиент и lo-fi', /ambient|эмбиент|drone|chill|lo.?fi|лоу.?фай|downtempo|new.?age/i],
  ['jazz', 'Джаз', /jazz|джаз/i],
  ['blues', 'Блюз', /blues|блюз/i],
  ['classical', 'Классика', /classic|классик|orchestr|opera|опер|baroque/i],
  ['soundtrack', 'Саундтреки', /soundtrack|\bost\b|саундтрек|score|film|кино|anime|аниме/i],
  ['folk', 'Фолк и кантри', /folk|фолк|country|кантри|bard|бард/i],
  ['rnb', 'R&B и соул', /r&b|rnb|soul|соул|funk|фанк/i],
  ['reggae', 'Регги', /reggae|регги|\bska\b/i],
  ['latin', 'Латино', /latin|salsa|reggaeton|латин/i],
  ['chanson', 'Шансон', /chanson|шансон/i],
  ['pop', 'Поп', /pop|поп|эстрад|estrada/i]
];
export const canonGenre = (raw) => { if (!raw) return null; for (const [k, , re] of GENRES) if (re.test(raw)) return k; return null; };
export const genreLabel = (k) => (GENRES.find((g) => g[0] === k) || [k, k])[1];
export const trackGenre = (t) => (t._g !== undefined ? t._g : (t._g = canonGenre(t.genre)));
export const isRu = (t) => (t._ru !== undefined ? t._ru : (t._ru = /[а-яё]/i.test((t.title || '') + (t.artist || ''))));
export const displayName = (k) => S.taste.names[k] || k;

export const artistWeight = (t) => {
  const al = artistList(t);
  if (!al.length) return 0;
  let s = 0;
  for (const a of al) s += S.taste.artists[nkey(a.name)] || 0;
  return s / al.length;
};
export const tasteOf = (t) => {
  const c = S.stats.counts[t.id] || { n: 0, s: 0 };
  const g = trackGenre(t);
  let s = artistWeight(t) + 0.8 * (g ? (S.taste.genres[g] || 0) : 0) + (S.taste.tracks[t.id] || 0) + 0.25 * Math.log1p(c.n) - 0.3 * c.s;
  if (S.taste.lang !== 'any') s += ((S.taste.lang === 'ru') === isRu(t)) ? 0.9 : -1.4;
  return s;
};
export const tasteBlocked = (t) => (S.taste.tracks[t.id] || 0) <= -4 || artistWeight(t) <= -3;
export const trackScore = (t, explore) => {
  const c = S.stats.counts[t.id] || { n: 0 };
  return Math.exp(clamp(0.6 * tasteOf(t), -4, 4)) * (c.n === 0 ? 1 + explore * 0.8 : 1 - explore * 0.35);
};
export const bump = (obj, key, d, lo = -6, hi = 10) => { if (key) obj[key] = clamp((obj[key] || 0) + d, lo, hi); };
export const LEARN = { like: [3, 1.2, 0.6], unlike: [-3, -1.2, -0.6], done: [0.3, 0.15, 0.08], skip: [-0.9, -0.3, -0.12], dislike: [-6, -1.2, -0.5], more: [1.2, 0.6, 0.3] };
export let learnCount = 0;
export const learn = (t, kind) => {
  const [dt, da, dg] = LEARN[kind];
  bump(S.taste.tracks, t.id, dt, -8, 8);
  const al = artistList(t);
  for (const a of al) { bump(S.taste.artists, nkey(a.name), da / al.length); S.taste.names[nkey(a.name)] = a.name; }
  bump(S.taste.genres, trackGenre(t), dg);
  if (++learnCount % 300 === 0) for (const k of Object.keys(S.taste.tracks)) if (Math.abs(S.taste.tracks[k]) < 0.5) delete S.taste.tracks[k];
  saveStats();
  if (kind === 'like' || kind === 'dislike' || kind === 'skip') adaptLine();
  else if (kind === 'more') adaptLine(2);
};
export const dislikeTrack = (t) => {
  learn(t, 'dislike');
  toast(`Больше не предложу: ${t.title}`);
  if (cur() && cur().id === t.id) { S.rec.counted = true; next(false); }
  else if (S.view.type === 'line') renderMain();
};
