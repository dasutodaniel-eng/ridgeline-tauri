import { S } from './state.js';
import { slim } from './util.js';
import { saveStats } from './store.js';
import { artistList } from './data.js';

export const recordPlay = (t) => {
  const c = S.stats.counts[t.id] || (S.stats.counts[t.id] = { n: 0, s: 0, last: 0, t: null });
  c.n++; c.last = Date.now(); c.t = slim(t);
  S.stats.recent = S.stats.recent.filter((x) => x.id !== t.id);
  S.stats.recent.push(slim(t));
  if (S.stats.recent.length > 150) S.stats.recent.shift();
  const keys = Object.keys(S.stats.counts);
  if (keys.length > 1500) {
    keys.sort((a, b) => S.stats.counts[a].n - S.stats.counts[b].n || S.stats.counts[a].last - S.stats.counts[b].last);
    for (const k of keys.slice(0, 200)) delete S.stats.counts[k];
  }
  saveStats();
};
export const recordSkip = (t) => {
  const c = S.stats.counts[t.id] || (S.stats.counts[t.id] = { n: 0, s: 0, last: 0, t: slim(t) });
  c.s++; saveStats();
};
export const artistPlays = () => {
  const m = new Map();
  for (const c of Object.values(S.stats.counts)) {
    if (!c.t) continue;
    for (const a of artistList(c.t)) m.set(a.name.toLowerCase(), (m.get(a.name.toLowerCase()) || 0) + c.n);
  }
  return m;
};
