import { R, S, api, cur } from './state.js';
import { clamp, errText, nkey, sampleWeighted, toast } from './util.js';
import { artistList, trackPool } from './data.js';
import { learn, tasteBlocked, trackGenre, trackScore } from './taste.js';
import { openView } from './nav.js';
import { renderSidebar } from './sidebar.js';
import { renderMain } from './pages.js';
import { afterQueueChange } from './queue.js';
import { openWelcome } from './welcome.js';
import { playIndex } from './player.js';

export const spreadArtists = (arr) => {
  const out = [], rest = arr.slice();
  let last = S.queue.length ? (artistList(S.queue[S.queue.length - 1])[0] || {}).name : null;
  while (rest.length) {
    let k = rest.findIndex((t) => (artistList(t)[0] || {}).name !== last);
    if (k < 0) k = 0;
    const t = rest.splice(k, 1)[0];
    out.push(t); last = (artistList(t)[0] || {}).name;
  }
  return out;
};
export const artistIdMap = () => {
  const m = new Map();
  for (const t of [...S.lib.favorites, ...S.stats.recent, ...(R.likesCache || [])]) {
    if (t.src === 'ym') for (const a of artistList(t)) if (a.id) m.set(nkey(a.name), a.id);
  }
  return m;
};
export const artistPopCache = new Map();
export async function fillLine(n) {
  if (S.line.busy) return;
  S.line.busy = true;
  try {
    const explore = S.stats.explore;
    const recent = new Set([...S.queue.slice(-40).map((t) => t.id), ...S.stats.recent.slice(-20).map((t) => t.id)]);
    const pool = new Map();
    for (const t of trackPool()) pool.set(t.id, t);
    const disc = new Map();
    const lovedMode = S.line.mode === 'loved';
    const lovedSet = lovedMode ? new Set(lovedArtistKeys()) : null;
    const seedT = S.line.seedFills > 0 ? S.line.seed : null;
    const onlyLoved = (t) => !lovedSet || artistList(t).some((a) => lovedSet.has(nkey(a.name)));
    if (S.ym.connected) {
      if (!R.likesCache) { try { R.likesCache = await api.ym.likes(); } catch (e) { toast('Яндекс: ' + errText(e)); } }
      const known = [...S.lib.favorites, ...(R.likesCache || [])].filter((t) => t.src === 'ym' && !tasteBlocked(t));
      const seeds = [];
      if (seedT && seedT.src === 'ym') seeds.push(seedT);
      if (!lovedMode) {
        if (cur() && cur().src === 'ym' && !tasteBlocked(cur())) seeds.push(cur());
        if (known.length) seeds.push(...sampleWeighted(known, known.map((t) => trackScore(t, 0)), 2, Math.random));
      }
      const seen = new Set();
      for (const sd of seeds.filter((x) => x.ymId && !seen.has(x.ymId) && seen.add(x.ymId)).slice(0, 3)) {
        try { for (const t of await api.ym.similar(sd.ymId)) if (!pool.has(t.id)) disc.set(t.id, t); } catch { /* похожие недоступны */ }
      }
      const loved = [...artistIdMap().entries()].filter(([k]) => (S.taste.artists[k] || 0) >= 2);
      for (const [, id] of sampleWeighted(loved, loved.map(() => 1), lovedMode ? 2 : 1, Math.random)) {
        try {
          let pop = artistPopCache.get(id);
          if (!pop) { pop = (await api.ym.artist(id)).popular; artistPopCache.set(id, pop); }
          for (const t of pop) if (!pool.has(t.id)) disc.set(t.id, t);
        } catch { /* пропускаем */ }
      }
    }
    const okLocal = [...pool.values()].filter((t) => !tasteBlocked(t) && onlyLoved(t));
    let lc = okLocal.filter((t) => !recent.has(t.id));
    if (lc.length < n) lc = okLocal;
    const dc = [...disc.values()].filter((t) => !tasteBlocked(t) && !recent.has(t.id) && onlyLoved(t));
    const seedArtist = seedT ? nkey((artistList(seedT)[0] || {}).name) : null;
    const seedGenre = seedT ? trackGenre(seedT) : null;
    const seedBoost = (t) => (seedArtist && artistList(t).some((a) => nkey(a.name) === seedArtist) ? 2.5 : 1) * (seedGenre && trackGenre(t) === seedGenre ? 1.5 : 1);
    const wl = lc.map((t) => trackScore(t, explore) * seedBoost(t));
    let wd = dc.map((t) => trackScore(t, explore) * seedBoost(t));
    const sumL = wl.reduce((a, b) => a + b, 0), sumD = wd.reduce((a, b) => a + b, 0);
    if (sumL > 0 && sumD > 0) {
      const share = clamp(0.15 + explore * 0.6, 0.15, 0.7);
      const k = (share / (1 - share)) * (sumL / sumD);
      wd = wd.map((x) => x * k);
    }
    const inQueue = new Set(S.queue.map((t) => t.id));
    const cand = [...lc, ...dc], w = [...wl, ...wd];
    const idxs = cand.map((_, i) => i).filter((i) => !inQueue.has(cand[i].id));
    if (!idxs.length) { toast(lovedMode ? 'У любимых исполнителей не нашлось новых треков' : 'Для Линии нужна музыка: добавь папку или подключи Яндекс'); return; }
    const picked = spreadArtists(sampleWeighted(idxs.map((i) => cand[i]), idxs.map((i) => w[i]), n, Math.random));
    S.queue.push(...picked);
    if (S.line.seedFills > 0 && --S.line.seedFills === 0) S.line.seed = null;
    afterQueueChange();
  } finally { S.line.busy = false; }
}
export let adaptT;
export const adaptLine = (ahead = 3) => {
  if (!S.line.active) return;
  clearTimeout(adaptT);
  adaptT = setTimeout(() => {
    if (!S.line.active || S.line.busy) return;
    const keep = S.idx + ahead;
    if (S.queue.length > keep) S.queue.splice(keep);
    fillLine(8);
  }, 900);
};
export const lovedArtistKeys = () => Object.entries(S.taste.artists).filter(([, w]) => w >= 2).map(([k]) => k);
export async function startLine(seed, mode, opts = {}) {
  if (S.line.busy) return;
  if (!S.taste.done && !S.taste.skipped) return openWelcome({ thenLine: true, mode });
  if (mode === 'loved' && !lovedArtistKeys().length) {
    toast('Сначала отметь любимых исполнителей');
    return openWelcome({ thenLine: true, mode });
  }
  const keep = opts.keepCurrent && cur() ? cur() : null;
  S.line.active = true; S.line.seed = seed || null; S.line.seedFills = seed ? 4 : 0; S.line.mode = mode || 'all';
  S.queue = keep ? [keep] : (seed ? [seed] : []); S.idx = keep ? 0 : -1; S.history = [];
  renderSidebar();
  toast(S.line.mode === 'loved' ? 'Собираю Линию по любимым…' : 'Собираю Линию…');
  await fillLine(12);
  if (S.queue.length <= (keep ? 1 : 0)) { S.line.active = false; renderSidebar(); return; }
  if (!keep) playIndex(0);
  if (S.view.type !== 'line') openView({ type: 'line' }); else renderMain();
}
export const setLineMode = (mode) => {
  if (mode === 'loved' && !lovedArtistKeys().length) { toast('Сначала отметь любимых исполнителей'); return; }
  S.line.mode = mode;
  if (!S.line.active) return startLine(null, mode);
  S.queue.splice(S.idx + 2);
  fillLine(10);
};
export const moreLikeThis = (t) => {
  learn(t, 'more');
  S.line.seed = t; S.line.seedFills = 4;
  if (!S.line.active) { startLine(t, S.line.mode, { keepCurrent: cur() && cur().id === t.id }); toast('Включаю Линию по этому треку'); }
  else toast('Подкину больше похожего');
};
export const stopLine = () => {
  S.line.active = false; S.line.seed = null;
  renderSidebar(); renderMain();
  toast('Линия остановлена, очередь осталась');
};
