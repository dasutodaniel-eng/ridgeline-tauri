import { mascotSvg } from './mascot.js';
import { sourceOf } from './sources/index.js';
import { $, S, cur } from './state.js';
import { IC, fmt, fmtLong, h, svg, toast, tracksWord } from './util.js';
import { saveLib } from './store.js';
import { artistList, findPlaylist, isFav } from './data.js';
import { dislikeTrack } from './taste.js';
import { albumNode, artBox, artistsNode, coverEl, openLink } from './uikit.js';
import { addToPlaylist, createPlaylist, toggleFav } from './library.js';
import { askText, showMenu } from './overlays.js';
import { openView } from './nav.js';
import { renderSidebar } from './sidebar.js';
import { renderMain } from './pages.js';
import { afterQueueChange, enqueue, playFrom, removeFromQueue, startList } from './queue.js';
import { moreLikeThis, startLine } from './line.js';

export const makeRow = (t, i, list) => {
  const r = h('div', 'row');
  r.dataset.id = t.id; r.dataset.i = i; r._t = t; r._list = list;
  const idx = h('div', 'idx');
  idx.append(h('span', 'num', String(i + 1)));
  const eq = h('span', 'eq'); eq.innerHTML = '<i></i><i></i><i></i>';
  const pb = h('button', 'pbtn'); pb.innerHTML = svg(IC.play); pb.title = 'Играть';
  idx.append(eq, pb);
  const tt = h('div', 'tt');
  const tx = h('div', 'tx'); const a = h('div', 'a'); a.append(artistsNode(t));
  const nm = h('div', 'n', t.title);
  const badge = sourceOf(t).badge;
  if (badge) nm.append(h('span', 'srcb', badge));
  tx.append(nm, a);
  tt.append(coverEl(t), tx);
  const hb = h('button', 'heart'); hb.innerHTML = svg(IC.heart); hb.title = 'В любимые';
  if (isFav(t)) hb.classList.add('on');
  const mb = h('button', 'more'); mb.innerHTML = svg(IC.more); mb.title = 'Ещё';
  const al = h('div', 'al'); al.append(albumNode(t));
  r.append(idx, tt, al, hb, h('div', 'du', t.duration ? fmt(t.duration) : ''), mb);
  if (cur() && cur().id === t.id) r.classList.add('cur');
  return r;
};
export const makeList = (tracks, limit, offset = 0) => {
  const tl = h('div', 'tl');
  const frag = document.createDocumentFragment();
  const n = limit ? Math.min(limit, tracks.length) : tracks.length;
  for (let i = 0; i < n; i++) frag.append(makeRow(tracks[i], i + offset, tracks));
  tl.append(frag);
  return tl;
};
export function softRefresh() {
  document.querySelectorAll('.row').forEach((r) => {
    const t = r._t;
    r.querySelector('.n').firstChild.nodeValue = t.title;
    r.querySelector('.a').replaceChildren(artistsNode(t));
    r.querySelector('.al').replaceChildren(albumNode(t));
    r.querySelector('.du').textContent = t.duration ? fmt(t.duration) : '';
  });
}
export const markCurrent = () => {
  const id = cur() ? cur().id : null;
  document.querySelectorAll('.row').forEach((r) => r.classList.toggle('cur', r._t.id === id));
};

export const header = ({ title, sub, subNode, tracks, menuItems, art }) => {
  const hd = h('div', 'hd' + (art ? ' artist' + (art.round ? '' : ' album') : ''));
  const txt = h('div', 'txt');
  if (art) {
    const av = artBox(art.tracks, { round: art.round, seed: art.seed || title, kind: art.kind });
    av.classList.add('avatar');
    if (art.cover) { av.style.background = ''; av.style.backgroundImage = `url("${art.cover.replace('%%', '400x400')}")`; av.textContent = ''; av.classList.remove('mosaic'); av.innerHTML = ''; }
    hd.append(av);
  }
  txt.append(h('h1', 'vt', title));
  const vs = h('p', 'vs'); if (subNode) vs.append(subNode); else vs.textContent = sub || '';
  txt.append(vs);
  const bar = h('div', 'hbar');
  if (tracks && tracks.length) {
    const pl = h('button', 'bigplay'); pl.innerHTML = svg(IC.play); pl.title = 'Играть';
    pl.onclick = () => startList(tracks, false);
    const sh = h('button', 'ico'); sh.innerHTML = svg(IC.shuffle); sh.title = 'Перемешать и играть';
    sh.onclick = () => startList(tracks, true);
    bar.append(pl, sh);
  }
  const items = [];
  if (tracks && tracks.length) {
    items.push(
      { label: 'Добавить всё в очередь', fn: () => enqueue(tracks) },
      { label: 'Сохранить как плейлист…', fn: async () => {
        const n = await askText('Название плейлиста', title, 'Создать');
        if (n) { const p = createPlaylist(n, tracks); openView({ type: 'playlist', id: p.id }); }
      } }
    );
  }
  if (menuItems && menuItems.length) { if (items.length) items.push({ sep: true }); items.push(...menuItems); }
  if (items.length) {
    const mb = h('button', 'ico'); mb.innerHTML = svg(IC.more); mb.title = 'Ещё';
    mb.onclick = () => { const r = mb.getBoundingClientRect(); showMenu(r.left, r.bottom + 4, items); };
    bar.append(mb);
  }
  txt.append(bar);
  hd.append(txt);
  return hd;
};
export const subLine = (tracks, extra) => {
  const dur = tracks.reduce((a, t) => a + (t.duration || 0), 0);
  return [tracksWord(tracks.length), dur ? fmtLong(dur) : null, extra].filter(Boolean).join('  ·  ');
};
export const emptyBox = (html, mood = 'sleepy') => {
  const d = h('div', 'empty withm');
  d.innerHTML = `<div class="em">${mascotSvg({ mood, note: false, laptop: mood !== 'wow' })}</div><div class="et">${html}</div>`;
  return d;
};
export const secHead = (label, btn) => { const s = h('div', 'sec'); s.append(h('span', '', label)); if (btn) s.append(btn); return s; };

export const mainEl = $('#main');
mainEl.addEventListener('click', (e) => {
  const r = e.target.closest('.row');
  if (!r) return;
  if (e.target.closest('.pbtn')) return playFrom(r._list, +r.dataset.i);
  if (e.target.closest('.heart')) return toggleFav(r._t);
  if (e.target.closest('.more')) { const b = e.target.closest('.more').getBoundingClientRect(); return trackMenu(r, b.left - 180, b.bottom); }
});
mainEl.addEventListener('dblclick', (e) => {
  const r = e.target.closest('.row');
  if (r && !e.target.closest('button')) playFrom(r._list, +r.dataset.i);
});
mainEl.addEventListener('contextmenu', (e) => {
  const r = e.target.closest('.row');
  if (r) { e.preventDefault(); trackMenu(r, e.clientX, e.clientY); }
});

export const trackMenu = (row, x, y) => {
  const t = row._t, i = +row.dataset.i;
  const first = artistList(t)[0];
  const items = [
    { label: 'Играть следующим', fn: () => { S.queue.splice(S.idx + 1, 0, t); afterQueueChange(); toast('Сыграет следующим'); } },
    { label: 'Добавить в очередь', fn: () => enqueue([t]) },
    { label: 'В плейлист…', fn: () => playlistPicker(x, y, [t]) },
    { label: isFav(t) ? 'Убрать из любимых' : 'В любимые', fn: () => toggleFav(t) },
    { sep: true },
    { label: 'Больше такого', fn: () => moreLikeThis(t) },
    { label: 'Включить Линию по этому треку', fn: () => startLine(t, S.line.mode) },
    { label: 'Не рекомендовать', fn: () => dislikeTrack(t) }
  ];
  if (first) items.push({ label: 'К исполнителю: ' + first.name, fn: () => openLink({ k: first.id ? (first.src === 'sc' ? 'sc-artist' : 'ym-artist') : 'artist', id: first.id, name: first.name }) });
  if (t.album) items.push({ label: 'К альбому', fn: () => openLink({ k: t.albumId ? 'ym-album' : 'album', id: t.albumId, name: t.album, artist: first ? first.name : '' }) });
  if (S.view.type === 'playlist') {
    const p = findPlaylist(S.view.id);
    if (p && row._list === p.tracks) items.push({ sep: true }, { label: 'Убрать из плейлиста', fn: () => { p.tracks.splice(i, 1); saveLib(); renderSidebar(); renderMain(); } });
  }
  if (S.view.type === 'queue') items.push({ sep: true }, { label: 'Убрать из очереди', fn: () => removeFromQueue(i) });
  showMenu(x, y, items);
};
export const playlistPicker = (x, y, tracks) => {
  const items = [{ head: 'В плейлист' }];
  for (const p of S.lib.playlists) items.push({ label: p.name, fn: () => addToPlaylist(p, tracks) });
  if (S.lib.playlists.length) items.push({ sep: true });
  items.push({ label: 'Новый плейлист…', fn: async () => {
    const n = await askText('Новый плейлист', '', 'Создать');
    if (n) { createPlaylist(n, tracks); toast(`Плейлист «${n}» создан`); }
  } });
  setTimeout(() => showMenu(x, y, items), 0);
};
