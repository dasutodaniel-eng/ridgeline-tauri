import { $, S, api } from './state.js';
import { dayKey, errText, h, plural, rngSeed, setFill, shuffled, toast, tracksWord } from './util.js';
import { saveStats } from './store.js';
import { allLocal, artistList, artistTracks, byAlbumOrder, findFolder, findPlaylist, groupAlbums, trackPool } from './data.js';
import { displayName, genreLabel, trackGenre } from './taste.js';
import { artBox, makeCard, shelf } from './uikit.js';
import { deletePlaylist, removeFolder, renamePlaylist, scanFolder } from './library.js';
import { openView } from './nav.js';
import { computeMix, mixCard, topArtists } from './mixes.js';
import { emptyBox, header, makeList, makeRow, markCurrent, secHead, subLine } from './rows.js';
import { clearQueue, startList } from './queue.js';
import { openWelcome } from './welcome.js';
import { setLineMode, startLine, stopLine } from './line.js';

export let viewToken = 0;

export const renderHome = (sc) => {
  const hr = new Date().getHours();
  sc.append(h('div', 'greet', (hr < 5 ? 'ДОБРОЙ НОЧИ' : hr < 12 ? 'ДОБРОЕ УТРО' : hr < 18 ? 'ДОБРЫЙ ДЕНЬ' : 'ДОБРЫЙ ВЕЧЕР')));

  const hero = h('div', 'hero');
  const left = h('div');
  left.append(h('h2', '', 'ЛИНИЯ'), h('p', '', 'Бесконечный поток под твой вкус: из библиотеки, любимого и похожего из Яндекса. Пропуски и лайки её учат.'));
  const go = h('button', 'btn primary', S.line.active ? 'Открыть Линию' : 'Включить Линию');
  go.onclick = () => (S.line.active ? openView({ type: 'line' }) : startLine(null, 'all'));
  const gl = h('button', 'btn', 'Только любимые'); gl.style.marginLeft = '10px';
  gl.onclick = () => startLine(null, 'loved');
  left.append(go);
  if (S.taste.done && !S.line.active) left.append(gl);
  const orb = h('div', 'orb'); orb.style.width = orb.style.height = '96px';
  hero.append(left, orb);
  sc.append(hero);

  const pool = trackPool();
  const tiles = h('div', 'tiles');
  const tile = (label, tracks, seed, view, kind) => {
    const t = h('div', 'tile'); t.append(artBox(tracks, { seed, kind }), h('span', '', label));
    t.onclick = () => openView(view); return t;
  };
  tiles.append(tile('Любимые', S.lib.favorites, 'fav', { type: 'fav' }, 'fav'));
  tiles.append(tile('Недавно играло', S.stats.recent.slice(-4), 'recent', { type: 'mix', id: 'recent' }, 'recent'));
  tiles.append(tile('Микс дня', pool.slice(0, 4), 'daily' + dayKey(), { type: 'mix', id: 'daily' }, 'daily'));
  if (S.ym.connected) tiles.append(tile('Яндекс: Мне нравится', [], 'ym', { type: 'ym-likes' }));
  sc.append(tiles);

  if (!pool.length && !S.ym.connected) {
    sc.append(emptyBox('Пока пусто.<br>Добавь папку с музыкой кнопкой <b>+</b> рядом с «Папки» или подключи Яндекс Музыку внизу слева.'));
    return;
  }
  const mixes = ['daily', 'forgotten', 'top', 'recent', 'albumday'].map((id) => mixCard(id)).filter(Boolean);
  for (const a of topArtists(3)) { const c = mixCard('artist:' + a.name, a.name); if (c) mixes.push(c); }
  const gcount = new Map();
  for (const t of pool) { const g = trackGenre(t); if (g) gcount.set(g, (gcount.get(g) || 0) + 1); }
  [...gcount.entries()].filter(([, n]) => n >= 8).sort((a, b) => (S.taste.genres[b[0]] || 0) * 3 + b[1] * 0.05 - ((S.taste.genres[a[0]] || 0) * 3 + a[1] * 0.05)).slice(0, 2)
    .forEach(([g]) => { const c = mixCard('genre:' + g, g); if (c) mixes.push(c); });
  if (mixes.length) sc.append(shelf('Подборки для тебя', mixes));

  const ta = topArtists(14);
  if (ta.length) {
    sc.append(shelf('Исполнители', ta.map((a) => makeCard({
      title: a.name, sub: tracksWord(a.n), tracks: a.tracks, round: true, seed: a.name,
      open: () => openView({ type: 'artist', name: a.name }),
      play: () => startList(shuffled(artistTracks(a.name), rngSeed(Date.now())), false)
    }))));
  }
  const albums = groupAlbums(allLocal()).filter((a) => a.tracks.length >= 2);
  if (albums.length) {
    const pick = shuffled(albums, rngSeed(dayKey() + 'alb')).slice(0, 14);
    sc.append(shelf('Альбомы в библиотеке', pick.map((a) => makeCard({
      title: a.name, sub: a.artist, tracks: a.tracks, seed: a.name,
      open: () => openView({ type: 'album', name: a.name, artist: a.artist }),
      play: () => startList(a.tracks, false)
    }))));
  }
  if (S.ym.connected && S.ym.playlists.length) {
    sc.append(shelf('Плейлисты Яндекса', S.ym.playlists.slice(0, 16).map((p) => makeCard({
      title: p.title, sub: tracksWord(p.count), tracks: [], seed: p.title,
      open: () => openView({ type: 'ym-playlist', id: String(p.uid), kind: String(p.kind), title: p.title })
    }))));
  }
};

export const tasteChips = () => {
  const wrap = h('div', 'chips');
  const arts = Object.entries(S.taste.artists).filter(([, w]) => w >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const gens = Object.entries(S.taste.genres).filter(([, w]) => w >= 1.5).sort((a, b) => b[1] - a[1]).slice(0, 4);
  for (const [k] of arts) wrap.append(h('span', 'chip', displayName(k)));
  for (const [k] of gens) wrap.append(h('span', 'chip alt', genreLabel(k)));
  const avoid = Object.values(S.taste.artists).filter((w) => w <= -3).length;
  if (avoid) wrap.append(h('span', 'chip dim', `исключено: ${avoid}`));
  return wrap;
};
export const renderLine = (sc) => {
  const hero = h('div', 'hero'); hero.style.marginTop = '30px'; hero.style.padding = '34px 36px';
  const left = h('div');
  left.append(h('h2', '', 'ЛИНИЯ'));
  const configured = S.taste.done;
  left.append(h('p', '', !configured
    ? 'Расскажи, что тебе нравится, и Линия будет подбирать похожее. Это займёт минуту.'
    : S.line.active
      ? 'Играет Линия. Сердечко учит её, «не моё» убирает исполнителя из подбора, быстрый пропуск тоже что-то значит.'
      : 'Бесконечный поток под твой вкус: из библиотеки и (если подключён Яндекс) похожего из него.'));
  if (configured) left.append(tasteChips());
  if (S.line.active && S.line.mode === 'loved') left.querySelector('.chips').prepend(h('span', 'chip', 'режим: только любимые'));
  const btns = h('div', 'btnrow');
  if (!configured) {
    const b1 = h('button', 'btn primary', 'Настроить вкус'); b1.onclick = () => openWelcome({ thenLine: true });
    const b2 = h('button', 'btn', 'Включить без настройки'); b2.onclick = () => { S.taste.skipped = true; saveStats(); startLine(null, 'all'); };
    btns.append(b1, b2);
  } else {
    const b1 = h('button', 'btn primary', S.line.active ? 'Остановить Линию' : 'Включить Линию');
    b1.onclick = () => (S.line.active ? stopLine() : startLine(null, 'all'));
    btns.append(b1);
    if (!S.line.active) {
      const bl = h('button', 'btn', 'Только любимые'); bl.title = 'Только исполнители, которых ты отметил любимыми';
      bl.onclick = () => startLine(null, 'loved'); btns.append(bl);
    }
    const b2 = h('button', 'btn', 'Настроить вкус'); b2.onclick = () => openWelcome({});
    btns.append(b2);
  }
  left.append(btns);
  if (configured && S.line.active) {
    const seg = h('div', 'seg');
    [['all', 'Всё по вкусу'], ['loved', 'Только любимые']].forEach(([k, l]) => {
      const b = h('button', S.line.mode === k ? 'on' : '', l);
      b.onclick = () => { setLineMode(k); if (S.line.mode === k) seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
      seg.append(b);
    });
    left.append(seg);
  }
  const sl = h('div', 'slider');
  const lb = h('div', 'lbls'); lb.append(h('span', '', 'Привычное'), h('span', '', 'Незнакомое'));
  const rg = h('input', 'range'); rg.type = 'range'; rg.min = 0; rg.max = 100; rg.value = Math.round(S.stats.explore * 100);
  setFill(rg);
  rg.oninput = () => { S.stats.explore = rg.value / 100; setFill(rg); saveStats(); };
  sl.append(lb, rg); left.append(sl);
  hero.append(left, h('div', 'orb'));
  sc.append(hero);
  const how = h('div', 'howto');
  how.innerHTML = 'Как она думает: у каждого трека есть вес из твоих ответов, лайков, прослушиваний до конца и пропусков. Исполнители и жанры учатся вместе с треками. Ползунок задаёт долю незнакомого. ' +
    (S.ym.connected ? 'Яндекс подмешивает похожее и популярное у любимых исполнителей.' : 'Подключи Яндекс Музыку, и к библиотеке добавятся новые треки оттуда.');
  sc.append(how);
  if (S.line.active && S.idx >= 0) {
    sc.append(secHead('Дальше в Линии'));
    const tl = h('div', 'tl');
    for (let i = S.idx + 1; i < Math.min(S.queue.length, S.idx + 9); i++) tl.append(makeRow(S.queue[i], i, S.queue));
    sc.append(tl);
  }
};

export const renderArtistPage = (sc, o) => {
  sc.append(header({ title: o.name, sub: o.sub, tracks: o.play, art: { tracks: o.mosaic, cover: o.cover, round: true }, menuItems: o.menuItems }));
  if (o.popular.length) {
    let expanded = false;
    const holder = h('div');
    const btn = o.popular.length > 5 ? h('button', '', 'Показать все') : null;
    const draw = () => { holder.textContent = ''; holder.append(makeList(o.popular, expanded ? 0 : 5)); if (btn) btn.textContent = expanded ? 'Свернуть' : 'Показать все'; };
    if (btn) btn.onclick = () => { expanded = !expanded; draw(); markCurrent(); };
    sc.append(secHead('Популярное', btn), holder); draw();
  }
  if (o.albums && o.albums.length) sc.append(shelf('Альбомы', o.albums));
  if (o.similar && o.similar.length) sc.append(shelf('Похожие исполнители', o.similar));
  if (o.all && o.all.length) { sc.append(secHead('Все треки')); sc.append(makeList(o.all)); }
};

export async function renderMain() {
  const token = ++viewToken;
  const v = S.view;
  const box = $('#main');
  box.textContent = '';
  const sc = h('div', 'scroll');
  box.append(sc);
  const alive = () => token === viewToken;
  const draw = (spec) => {
    if (!alive()) return;
    sc.textContent = '';
    sc.append(header(spec));
    if (spec.tracks.length) sc.append(makeList(spec.tracks));
    else sc.append(emptyBox(spec.empty || 'Здесь пока ничего нет.'));
  };
  const failed = (title, e) => {
    if (!alive()) return;
    sc.textContent = '';
    sc.append(header({ title, sub: '', tracks: [] }));
    const d = emptyBox(`<b>Не получилось загрузить.</b><br>${errText(e).replace(/</g, '&lt;')}`, 'wow');
    const b = h('button', 'btn', 'Повторить'); b.style.marginTop = '14px'; b.onclick = renderMain;
    d.append(h('br'), b); sc.append(d);
  };
  const ymLoad = async (title, fn, render) => {
    sc.append(header({ title, sub: 'Загружаю…', tracks: [] }));
    try { const d = await fn(); if (!alive()) return; sc.textContent = ''; render(d); } catch (e) { failed(title, e); }
  };
  const ymAlbumCard = (a) => makeCard({
    title: a.title, sub: [a.year, a.count ? tracksWord(a.count) : null].filter(Boolean).join(' · '),
    tracks: a.cover ? [{ cover: a.cover }] : [], seed: a.title,
    open: () => openView({ type: 'ym-album', id: a.id, title: a.title })
  });
  const ymArtistCard = (a) => makeCard({
    title: a.name, sub: 'Исполнитель', round: true, tracks: a.cover ? [{ cover: a.cover }] : [], seed: a.name,
    open: () => openView({ type: 'ym-artist', id: a.id, name: a.name })
  });

  if (v.type === 'home') renderHome(sc);
  else if (v.type === 'line') renderLine(sc);
  else if (v.type === 'all') {
    const t = allLocal();
    draw({ title: 'Вся музыка', sub: subLine(t), tracks: t, empty: 'Библиотека пуста.<br>Добавь папку с музыкой кнопкой <b>+</b> рядом с «Папки» или перетащи файлы в окно.' });
  } else if (v.type === 'fav') {
    draw({ title: 'Любимые', sub: subLine(S.lib.favorites), tracks: S.lib.favorites, art: { tracks: S.lib.favorites },
      empty: 'Нажми на сердечко у трека, и он появится здесь. Работает и для локальных файлов, и для Яндекс Музыки.' });
  } else if (v.type === 'queue') {
    draw({ title: 'Очередь', sub: subLine(S.queue), tracks: S.queue, menuItems: [{ label: 'Очистить очередь', fn: clearQueue }], empty: 'Очередь пуста.' });
  } else if (v.type === 'folder') {
    const f = findFolder(v.id);
    if (!f) return openView({ type: 'home' });
    draw({ title: f.name, sub: subLine(f.tracks, f.path), tracks: f.tracks,
      menuItems: [{ label: 'Обновить папку', fn: async () => { toast('Сканирую…'); await scanFolder(f); } }, { label: 'Убрать из библиотеки', fn: () => removeFolder(f) }],
      empty: 'В папке не нашлось аудиофайлов. Нажми «Обновить папку» в меню.' });
  } else if (v.type === 'playlist') {
    const p = findPlaylist(v.id);
    if (!p) return openView({ type: 'home' });
    draw({ title: p.name, sub: subLine(p.tracks), tracks: p.tracks, art: { tracks: p.tracks },
      menuItems: [{ label: 'Переименовать', fn: () => renamePlaylist(p) }, { label: 'Удалить плейлист', fn: () => deletePlaylist(p) }],
      empty: 'Плейлист пуст. Добавляй треки через меню ⋯ у любого трека.' });
  } else if (v.type === 'mix') {
    const m = computeMix(v.id);
    draw({ title: m.title, sub: subLine(m.tracks, m.sub), tracks: m.tracks, art: { tracks: m.tracks, kind: v.id.split(':')[0], seed: m.title + (v.id === 'daily' ? dayKey() : '') }, empty: 'Пока нечего собрать: послушай что-нибудь, и подборка появится.' });
  } else if (v.type === 'artist') {
    const all = artistTracks(v.name);
    const plays = (t) => (S.stats.counts[t.id] ? S.stats.counts[t.id].n : 0);
    const popular = all.slice().sort((a, b) => plays(b) - plays(a) || byAlbumOrder(a, b));
    const albums = groupAlbums(all);
    const totalPlays = all.reduce((a, t) => a + plays(t), 0);
    renderArtistPage(sc, {
      name: v.name, mosaic: all, play: popular,
      sub: [tracksWord(all.length), albums.length ? `${albums.length} ${plural(albums.length, ['альбом', 'альбома', 'альбомов'])}` : null, totalPlays ? `${totalPlays} прослушиваний` : null].filter(Boolean).join('  ·  '),
      popular, all: all.slice().sort(byAlbumOrder),
      albums: albums.map((a) => makeCard({ title: a.name, sub: tracksWord(a.tracks.length), tracks: a.tracks, seed: a.name,
        open: () => openView({ type: 'album', name: a.name, artist: a.artist }), play: () => startList(a.tracks, false) })),
      menuItems: S.ym.connected ? [{ label: 'Найти в Яндекс Музыке', fn: () => { $('#search').value = v.name; openView({ type: 'search', q: v.name }); } }] : []
    });
  } else if (v.type === 'album') {
    const n = v.name.toLowerCase(), an = (v.artist || '').toLowerCase();
    const tracks = trackPool().filter((t) => (t.album || '').toLowerCase() === n && (!an || artistList(t).some((a) => a.name.toLowerCase() === an)))
      .sort((a, b) => (a.no || 1e9) - (b.no || 1e9) || (a.title || '').localeCompare(b.title || ''));
    const sn = h('span');
    if (v.artist) { const a = h('span', 'alink', v.artist); a.dataset.k = 'artist'; a.dataset.name = v.artist; sn.append(a, document.createTextNode('  ·  ' + subLine(tracks))); }
    else sn.textContent = subLine(tracks);
    draw({ title: v.name, subNode: sn, tracks, art: { tracks }, empty: 'В библиотеке нет треков этого альбома.' });
  } else if (v.type === 'ym-likes') {
    await ymLoad('Мне нравится', () => api.ym.likes(), (t) => draw({ title: 'Мне нравится', sub: subLine(t, 'Яндекс Музыка'), tracks: t, art: { tracks: t } }));
  } else if (v.type === 'ym-playlist') {
    await ymLoad(v.title, () => api.ym.playlist(v.id, v.kind), (t) => draw({ title: v.title, sub: subLine(t, 'Яндекс Музыка'), tracks: t, art: { tracks: t } }));
  } else if (v.type === 'ym-artist') {
    await ymLoad(v.name || 'Исполнитель', () => api.ym.artist(v.id), (a) => {
      renderArtistPage(sc, {
        name: a.name || v.name, cover: a.cover, mosaic: a.popular, play: a.popular, sub: 'Яндекс Музыка', popular: a.popular, all: null,
        albums: a.albums.map(ymAlbumCard), similar: a.similar.map(ymArtistCard)
      });
    });
  } else if (v.type === 'ym-album') {
    await ymLoad(v.title || 'Альбом', () => api.ym.album(v.id), (a) => {
      const sn = h('span');
      (a.artists || []).forEach((x, i) => {
        if (i) sn.append(document.createTextNode(', '));
        const s = h('span', 'alink', x.name); s.dataset.k = x.id ? 'ym-artist' : 'artist'; if (x.id) s.dataset.id = x.id; s.dataset.name = x.name; sn.append(s);
      });
      sn.append(document.createTextNode('  ·  ' + [a.year, subLine(a.tracks)].filter(Boolean).join('  ·  ')));
      draw({ title: a.title, subNode: sn, tracks: a.tracks, art: { tracks: a.tracks, cover: a.cover } });
    });
  } else if (v.type === 'search') {
    const q = v.q.toLowerCase();
    const local = trackPool().filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q));
    const remote = S.ym.connected || S.cfg.scSearch;
    sc.append(header({ title: `«${v.q}»`, sub: remote ? 'Ищу…' : tracksWord(local.length), tracks: [] }));
    if (local.length) { sc.append(secHead('Моя музыка')); sc.append(makeList(local)); }
    const parts = [`${tracksWord(local.length)} у тебя`];
    const sources = [];
    if (S.ym.connected) sources.push(['Яндекс Музыка', 'в Яндексе', () => api.ym.search(v.q)]);
    if (S.cfg.scSearch) sources.push(['SoundCloud', 'в SoundCloud', () => api.sc.search(v.q)]);
    for (const [label, where, fn] of sources) {
      try {
        const found = await fn();
        if (!alive()) return;
        parts.push(`${tracksWord(found.length)} ${where}`);
        if (found.length) { sc.append(secHead(label)); sc.append(makeList(found)); }
      } catch (e) { if (alive()) parts.push(`${label}: ${errText(e)}`); }
      if (alive()) sc.querySelector('.vs').textContent = parts.join(', ');
    }
    if (alive() && !local.length && !sc.querySelector('.sec')) sc.append(emptyBox('Ничего не нашлось.', 'wow'));
  } else if (v.type === 'sc-home') {
    await ymLoad('SoundCloud', () => api.sc.charts(), (t) => draw({ title: 'SoundCloud', sub: subLine(t, 'Популярное сейчас. Вставь ссылку на трек, плейлист или профиль в поиск'), tracks: t, art: { tracks: t } }));
  } else if (v.type === 'sc-link') {
    await ymLoad('SoundCloud', () => api.sc.resolve(v.url), (r) => draw({ title: r.title, sub: subLine(r.tracks, 'SoundCloud'), tracks: r.tracks, art: { tracks: r.tracks, cover: r.cover } }));
  } else if (v.type === 'sc-artist') {
    await ymLoad(v.name || 'Исполнитель', () => api.sc.artist(v.id), (a) => {
      renderArtistPage(sc, { name: a.name || v.name, cover: a.cover, mosaic: a.popular, play: a.popular, sub: 'SoundCloud', popular: a.popular, all: a.tracks, albums: [], similar: [] });
    });
  }
  markCurrent();
}
