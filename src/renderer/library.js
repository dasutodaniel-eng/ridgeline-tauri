import { S, api, cur } from './state.js';
import { errText, slim, toast, tracksWord, uid } from './util.js';
import { saveLib, saveQueue, saveStats } from './store.js';
import { learn } from './taste.js';
import { askText, confirmBox } from './overlays.js';
import { openView } from './nav.js';
import { renderSidebar } from './sidebar.js';
import { renderMain } from './pages.js';
import { softRefresh } from './rows.js';
import { syncPlayerHeart, updateNowPlaying } from './player.js';

export const enrich = async (tracks) => {
  for (let i = 0; i < tracks.length; i += 10) {
    const chunk = tracks.slice(i, i + 10);
    const metas = await api.describe(chunk.map((t) => t.path));
    metas.forEach((m, k) => {
      const t = chunk[k];
      if (m.title) t.title = m.title;
      if (m.artist) t.artist = m.artist;
      if (m.album) t.album = m.album;
      if (m.duration) t.duration = m.duration;
      if (m.no) t.no = m.no;
      t.genre = m.genre || null; delete t._g;
      delete t._new;
    });
    softRefresh(); saveLib(); saveQueue();
    if (chunk.includes(cur())) updateNowPlaying();
  }
  if (S.view.type === 'home') renderMain();
};
export const scanFolder = async (folder) => {
  const files = await api.expand([folder.path]);
  const known = new Map(folder.tracks.map((t) => [t.path, t]));
  folder.tracks = files.map((f) => known.get(f.path) ||
    { id: 'l:' + f.path, src: 'local', path: f.path, url: f.url, title: f.name, artist: '', album: '', duration: 0, _new: true });
  const fresh = folder.tracks.filter((t) => t._new);
  saveLib(); renderSidebar();
  if (S.view.type === 'folder' && S.view.id === folder.id) renderMain();
  await enrich(fresh);
};
export const addFolder = async () => {
  const dirs = await api.pickFolder();
  if (!dirs.length) return;
  const p = dirs[0];
  let f = S.lib.folders.find((x) => x.path === p);
  if (!f) { f = { id: uid(), name: p.split(/[\\/]/).filter(Boolean).pop() || p, path: p, tracks: [] }; S.lib.folders.push(f); }
  openView({ type: 'folder', id: f.id });
  toast('Сканирую папку…');
  await scanFolder(f);
  toast(`В папке ${tracksWord(f.tracks.length)}`);
};
export const createPlaylist = (name, tracks = []) => {
  const pl = { id: uid(), name, tracks: [] };
  S.lib.playlists.push(pl);
  if (tracks.length) addToPlaylist(pl, tracks, true);
  saveLib(); renderSidebar();
  return pl;
};
export const addToPlaylist = (pl, tracks, silent) => {
  const have = new Set(pl.tracks.map((t) => t.id));
  const add = tracks.filter((t) => !have.has(t.id)).map(slim);
  pl.tracks.push(...add);
  saveLib(); renderSidebar();
  if (S.view.type === 'playlist' && S.view.id === pl.id) renderMain();
  if (!silent) toast(add.length ? `В плейлист «${pl.name}»: ${add.length}` : 'Эти треки уже в плейлисте');
};
export const toggleFav = (t) => {
  const i = S.lib.favorites.findIndex((f) => f.id === t.id);
  if (i >= 0) S.lib.favorites.splice(i, 1); else S.lib.favorites.push(slim(t));
  saveLib();
  const on = i < 0;
  learn(t, on ? 'like' : 'unlike');
  if (t.src === 'ym' && S.ym.connected && S.cfg.syncLikes) {
    api.ym.like([t.ymId], on)
      .then(() => { if (on) S.seen.add(t.id); else S.seen.delete(t.id); saveStats(); })
      .catch((e) => toast('Яндекс: ' + errText(e) + ' (лайк сохранён только здесь)'));
  }
  document.querySelectorAll('.row').forEach((r) => { if (r._t.id === t.id) r.querySelector('.heart').classList.toggle('on', on); });
  syncPlayerHeart(); renderSidebar();
  if (S.view.type === 'fav') renderMain();
};

export const removeFolder = async (f) => {
  if (!(await confirmBox('Убрать папку?', `«${f.name}» исчезнет из библиотеки. Файлы на диске останутся.`, 'Убрать'))) return;
  S.lib.folders = S.lib.folders.filter((x) => x !== f);
  saveLib();
  if (S.view.type === 'folder' && S.view.id === f.id) S.view = { type: 'home' };
  renderSidebar(); renderMain();
};
export const renamePlaylist = async (p) => {
  const n = await askText('Название плейлиста', p.name, 'Сохранить');
  if (n) { p.name = n; saveLib(); renderSidebar(); renderMain(); }
};
export const deletePlaylist = async (p) => {
  if (!(await confirmBox('Удалить плейлист?', `«${p.name}» будет удалён. Сами треки останутся в библиотеке.`, 'Удалить'))) return;
  S.lib.playlists = S.lib.playlists.filter((x) => x !== p);
  saveLib();
  if (S.view.type === 'playlist' && S.view.id === p.id) S.view = { type: 'home' };
  renderSidebar(); renderMain();
};

export const backfillGenres = async () => {
  const todo = [];
  for (const f of S.lib.folders) for (const t of f.tracks) if (t.src === 'local' && t.genre === undefined) todo.push(t);
  for (let i = 0; i < todo.length; i += 20) {
    const ch = todo.slice(i, i + 20);
    try {
      const ms = await api.describe(ch.map((t) => t.path));
      ms.forEach((m, k) => { ch[k].genre = m.genre || null; delete ch[k]._g; });
    } catch { ch.forEach((t) => { t.genre = null; }); }
    await new Promise((r) => setTimeout(r, 40));
  }
  if (todo.length) saveLib();
};
