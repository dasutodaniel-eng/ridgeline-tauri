import { IC, coverUrl, h, svg } from './util.js';
import { artBg } from './art.js';
import { artistList } from './data.js';
import { openView } from './nav.js';

export const coverEl = (t) => {
  const c = h('div', 'cv');
  const u = coverUrl(t, 100);
  if (u) { c.style.backgroundImage = `url("${u}")`; c.classList.add('has-img'); }
  else c.style.background = artBg(t.album || t.artist || t.title);
  return c;
};
export const artBox = (tracks, { round = false, seed = '', kind } = {}) => {
  const a = h('div', 'art' + (round ? ' round' : ''));
  const covers = [];
  for (const t of tracks || []) { const u = coverUrl(t, 200); if (u && !covers.includes(u)) covers.push(u); if (covers.length >= 4) break; }
  if (covers.length >= 4 && !round) {
    a.classList.add('mosaic');
    covers.forEach((u) => { const i = h('i'); i.style.backgroundImage = `url("${u}")`; a.append(i); });
  } else if (covers.length) {
    a.style.backgroundImage = `url("${covers[0]}")`;
  } else {
    a.style.background = artBg(seed, kind);
  }
  return a;
};
export const makeCard = ({ title, sub, tracks, seed, kind, round, open, play }) => {
  const c = h('div', 'cc' + (round ? ' round' : ''));
  const art = artBox(tracks, { round, seed: seed || title, kind });
  if (play) {
    const pb = h('button', 'cplay'); pb.innerHTML = svg(IC.play); pb.title = 'Играть';
    pb.onclick = (e) => { e.stopPropagation(); play(); };
    art.append(pb);
  }
  c.append(art, h('div', 'ct', title), h('div', 'cs', sub || ''));
  c.onclick = open;
  return c;
};
export const shelf = (title, cards) => {
  const s = h('section', 'shelf');
  const hd = h('div', 'shead'); hd.append(h('h2', '', title));
  const rail = h('div', 'rail'); rail.append(...cards);
  s.append(hd, rail);
  return s;
};

export const artistsNode = (t) => {
  const frag = document.createDocumentFragment();
  const list = artistList(t);
  if (!list.length) { frag.append(document.createTextNode('Неизвестный исполнитель')); return frag; }
  list.forEach((a, i) => {
    if (i) frag.append(document.createTextNode(', '));
    const s = h('span', 'alink', a.name);
    s.dataset.k = a.id ? (a.src === 'sc' ? 'sc-artist' : 'ym-artist') : 'artist';
    if (a.id) s.dataset.id = a.id;
    s.dataset.name = a.name;
    frag.append(s);
  });
  return frag;
};
export const albumNode = (t) => {
  const frag = document.createDocumentFragment();
  if (!t.album) return frag;
  const s = h('span', 'alink', t.album);
  s.dataset.k = t.albumId ? 'ym-album' : 'album';
  if (t.albumId) s.dataset.id = t.albumId;
  s.dataset.name = t.album;
  const first = artistList(t)[0];
  if (first) s.dataset.artist = first.name;
  frag.append(s);
  return frag;
};
export const openLink = (d) => {
  if (d.k === 'artist') openView({ type: 'artist', name: d.name });
  else if (d.k === 'sc-artist') openView({ type: 'sc-artist', id: d.id, name: d.name });
  else if (d.k === 'ym-artist') openView({ type: 'ym-artist', id: d.id, name: d.name });
  else if (d.k === 'album') openView({ type: 'album', name: d.name, artist: d.artist || '' });
  else if (d.k === 'ym-album') openView({ type: 'ym-album', id: d.id, title: d.name });
};
document.addEventListener('click', (e) => {
  const l = e.target.closest('.alink');
  if (!l) return;
  e.stopPropagation(); e.preventDefault();
  openLink(l.dataset);
}, true);

// Маленькая уникальная иконка (боковая панель)
export const miniArt = (seed, kind) => {
  const m = h('span', 'mini');
  m.style.background = artBg(seed, kind);
  return m;
};
