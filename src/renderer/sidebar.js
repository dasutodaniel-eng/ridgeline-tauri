import { miniArt } from './uikit.js';
import { $, S, api } from './state.js';
import { IC, h, svg, toast } from './util.js';
import { allLocal } from './data.js';
import { addFolder, createPlaylist, deletePlaylist, removeFolder, renamePlaylist, scanFolder } from './library.js';
import { askText, showMenu, ymModal } from './overlays.js';
import { openView, viewKey } from './nav.js';
import { renderMain } from './pages.js';
import { openLoose } from './queue.js';
import { settingsModal } from './settings.js';
import { showAmbient } from './ambient.js';

export function renderSidebar() {
  const sb = $('#sidebar');
  const keep = sb.querySelector('.sb-scroll') ? sb.querySelector('.sb-scroll').scrollTop : 0;
  sb.textContent = '';
  const sc = h('div', 'sb-scroll');
  const nav = (icon, label, view, count, ctx, extra) => {
    const b = h('button', 'nav' + (extra ? ' ' + extra : '') + (viewKey(S.view) === viewKey(view) ? ' on' : ''));
    if (typeof icon === 'object') b.append(miniArt(icon.art, icon.kind)); else b.innerHTML = svg(icon);
    b.append(h('span', 'lb', label));
    if (count !== undefined) b.append(h('span', 'ct', String(count)));
    b.onclick = () => openView(view);
    if (ctx) b.oncontextmenu = (e) => { e.preventDefault(); ctx(e.clientX, e.clientY); };
    return b;
  };
  const head = (label, onAdd, title) => {
    const d = h('div', 'sb-head'); d.append(h('span', '', label));
    if (onAdd) { const b = h('button'); b.innerHTML = svg(IC.plus); b.title = title; b.onclick = onAdd; d.append(b); }
    return d;
  };

  sc.append(nav(IC.home, 'Главная', { type: 'home' }));
  const ln = nav(IC.wave, 'Линия', { type: 'line' }, undefined, null, 'line');
  if (S.line.active) ln.append(h('span', 'dot'));
  sc.append(ln);

  sc.append(head('Библиотека'));
  sc.append(nav(IC.note, 'Вся музыка', { type: 'all' }, allLocal().length));
  sc.append(nav(IC.heart, 'Любимые', { type: 'fav' }, S.lib.favorites.length));
  sc.append(nav(IC.queue, 'Очередь', { type: 'queue' }, S.queue.length));

  sc.append(head('Папки', addFolder, 'Добавить папку'));
  if (!S.lib.folders.length) sc.append(h('div', 'sb-note', 'Добавь папку с музыкой кнопкой +'));
  for (const f of S.lib.folders) {
    sc.append(nav({ art: f.name }, f.name, { type: 'folder', id: f.id }, f.tracks.length, (x, y) => showMenu(x, y, [
      { label: 'Обновить', fn: async () => { toast('Сканирую…'); await scanFolder(f); } },
      { label: 'Убрать из библиотеки', fn: () => removeFolder(f) }
    ])));
  }

  sc.append(head('Плейлисты', async () => {
    const name = await askText('Новый плейлист', '', 'Создать');
    if (name) openView({ type: 'playlist', id: createPlaylist(name).id });
  }, 'Новый плейлист'));
  if (!S.lib.playlists.length) sc.append(h('div', 'sb-note', 'Пока пусто'));
  for (const p of S.lib.playlists) {
    sc.append(nav({ art: p.name }, p.name, { type: 'playlist', id: p.id }, p.tracks.length, (x, y) => showMenu(x, y, [
      { label: 'Переименовать', fn: () => renamePlaylist(p) },
      { label: 'Удалить', fn: () => deletePlaylist(p) }
    ])));
  }

  sc.append(head('Яндекс Музыка'));
  if (S.ym.connected) {
    sc.append(nav(IC.heart, 'Мне нравится', { type: 'ym-likes' }));
    for (const p of S.ym.playlists) {
      sc.append(nav({ art: p.title }, p.title, { type: 'ym-playlist', id: String(p.uid), kind: String(p.kind), title: p.title }, p.count));
    }
    const note = h('div', 'sb-note');
    note.append(document.createTextNode(`${S.ym.login}${S.ym.plus ? ' · Плюс' : ' · без Плюса'} · `));
    const out = h('button', 'link', 'выйти');
    out.onclick = async () => {
      await api.ym.logout(); S.ym = { connected: false, login: '', plus: false, playlists: [] };
      if (S.view.type.startsWith('ym')) S.view = { type: 'home' };
      renderSidebar(); renderMain();
    };
    note.append(out); sc.append(note);
  } else {
    const b = h('button', 'nav'); b.innerHTML = svg(IC.ym); b.append(h('span', 'lb', 'Подключить'));
    b.onclick = ymModal; sc.append(b);
  }
  sc.append(head('SoundCloud'));
  sc.append(nav(IC.cloud, 'Популярное', { type: 'sc-home' }));
  sb.append(sc);
  sc.scrollTop = keep;

  const foot = h('div', 'sb-foot');
  const files = h('button', 'nav'); files.innerHTML = svg(IC.plus); files.append(h('span', 'lb', 'Открыть файлы'));
  files.onclick = async () => openLoose(await api.pickFiles(), true);
  const amb = h('button', 'nav'); amb.innerHTML = svg(IC.moon); amb.append(h('span', 'lb', 'Ambient'));
  amb.title = 'Режим «Sunday» (клавиша A)';
  amb.onclick = () => showAmbient();
  const cfgBtn = h('button', 'nav'); cfgBtn.innerHTML = svg(IC.gear); cfgBtn.append(h('span', 'lb', 'Настройки'));
  cfgBtn.onclick = settingsModal;
  foot.append(files, amb, cfgBtn); sb.append(foot);
}
