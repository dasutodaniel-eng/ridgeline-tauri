import { R, S, api } from './state.js';
import { errText, slim, toast } from './util.js';
import { saveLib, saveStats } from './store.js';
import { renderSidebar } from './sidebar.js';
import { renderMain } from './pages.js';

export const refreshYm = async () => {
  try {
    const st = await api.ym.status();
    S.ym = { connected: !!st.connected, login: st.login || '', plus: !!st.plus, playlists: [] };
    if (st.connected) { try { S.ym.playlists = await api.ym.playlists(); } catch (e) { toast(errText(e)); } }
  } catch { S.ym.connected = false; }
  renderSidebar();
  if (S.view.type === 'home') renderMain();
  if (S.ym.connected) syncLikes(false);
};

export async function syncLikes(manual) {
  if (!S.ym.connected || !S.cfg.syncLikes || S.sync.busy) return;
  S.sync.busy = true;
  try {
    const likes = await api.ym.likes();
    R.likesCache = likes;
    const remote = new Set(likes.map((t) => t.id));
    const first = S.seen.size === 0;
    const have = new Set(S.lib.favorites.map((t) => t.id));
    // убрано здесь, но осталось в Яндексе: снимаем лайк там
    const stale = first ? [] : likes.filter((t) => S.seen.has(t.id) && !have.has(t.id));
    if (stale.length) { await api.ym.like(stale.map((t) => t.ymId), false); stale.forEach((t) => remote.delete(t.id)); }
    // новое в Яндексе: забираем себе
    let pulled = 0;
    for (const t of likes) if (!have.has(t.id) && remote.has(t.id) && (first || !S.seen.has(t.id))) { S.lib.favorites.push(slim(t)); pulled++; }
    // снято в Яндексе: убираем у себя
    let removed = 0;
    if (!first) {
      const before = S.lib.favorites.length;
      S.lib.favorites = S.lib.favorites.filter((t) => !(t.src === 'ym' && S.seen.has(t.id) && !remote.has(t.id)));
      removed = before - S.lib.favorites.length;
    }
    // новое у нас: отправляем в Яндекс
    const localOnly = S.lib.favorites.filter((t) => t.src === 'ym' && !remote.has(t.id));
    if (localOnly.length) await api.ym.like(localOnly.map((t) => t.ymId), true);
    S.seen = new Set([...remote, ...localOnly.map((t) => t.id)]);
    S.sync.last = Date.now();
    S.sync.msg = `получено ${pulled}, отправлено ${localOnly.length}, убрано ${removed}`;
    saveLib(); saveStats(); renderSidebar();
    if (pulled || removed || localOnly.length) { if (S.view.type === 'fav' || S.view.type === 'home') renderMain(); if (manual || pulled > 0) toast('Лайки синхронизированы: ' + S.sync.msg); }
    else if (manual) toast('Лайки уже совпадают');
  } catch (e) {
    S.sync.msg = 'ошибка: ' + errText(e);
    if (manual) toast('Синхронизация: ' + errText(e));
  } finally { S.sync.busy = false; }
}
