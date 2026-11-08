import { S, api, audio } from './state.js';
import { toast } from './util.js';
import { saveQueue } from './store.js';
import { enrich } from './library.js';
import { renderSidebar } from './sidebar.js';
import { renderMain } from './pages.js';
import { playIndex, setPCover, setShuffle, stopHls, updateNowPlaying } from './player.js';

export const afterQueueChange = () => {
  saveQueue(); renderSidebar();
  if (S.view.type === 'queue' || S.view.type === 'line') renderMain();
};
export const enqueue = (tracks) => {
  const wasEmpty = !S.queue.length;
  S.queue.push(...tracks);
  afterQueueChange();
  if (wasEmpty) playIndex(0); else toast(`В очереди +${tracks.length}`);
};
export const clearQueue = () => {
  S.queue = []; S.idx = -1; S.history = []; S.line.active = false;
  stopHls(); audio.pause(); audio.removeAttribute('src'); audio.load();
  updateNowPlaying(); setPCover(null); afterQueueChange();
};
export const removeFromQueue = (i) => {
  const was = i === S.idx;
  S.queue.splice(i, 1);
  S.history = S.history.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x));
  if (!S.queue.length) return clearQueue();
  if (was) playIndex(Math.min(i, S.queue.length - 1)); else if (i < S.idx) S.idx--;
  afterQueueChange();
};
export const playFrom = (list, i) => {
  if (list === S.queue) return playIndex(i);
  S.line.active = false;
  S.queue = list.slice(); S.history = [];
  playIndex(i); afterQueueChange();
};
export const startList = (tracks, shuffle) => {
  if (!tracks.length) return;
  if (shuffle) setShuffle(true);
  playFrom(tracks, shuffle ? Math.floor(Math.random() * tracks.length) : 0);
};
export const openLoose = async (paths, play) => {
  if (!paths || !paths.length) return;
  const files = await api.expand(paths);
  if (!files.length) return toast('Аудиофайлов не найдено');
  const tracks = files.map((f) => ({ id: 'l:' + f.path, src: 'local', path: f.path, url: f.url, title: f.name, artist: '', album: '', duration: 0 }));
  const wasEmpty = !S.queue.length;
  if (play && !wasEmpty) { S.line.active = false; S.queue = tracks; S.history = []; playIndex(0); afterQueueChange(); }
  else { S.queue.push(...tracks); afterQueueChange(); if (wasEmpty) playIndex(0); else toast(`В очереди +${tracks.length}`); }
  enrich(tracks);
};
