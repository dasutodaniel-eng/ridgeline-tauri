import { S, api, audio, cur } from './state.js';
import { debounce, slim } from './util.js';

export const saveLib = debounce(() => api.save('library', {
  folders: S.lib.folders.map((f) => ({ ...f, tracks: f.tracks.map(slim) })),
  playlists: S.lib.playlists.map((p) => ({ ...p, tracks: p.tracks.map(slim) })),
  favorites: S.lib.favorites.map(slim)
}), 500);
export const saveQueue = debounce(() => api.save('queue', S.queue.map(slim)), 500);
export const saveStats = debounce(() => api.save('stats', { ...S.stats, taste: S.taste, cfg: { ...S.cfg, ymSeen: [...S.seen] } }), 1500);
export let lastPb = 0;
export const savePlayback = debounce(() => {
  lastPb = Date.now();
  api.save('playback', { current: cur() ? cur().id : null, time: audio.currentTime || 0, volume: S.volume, muted: S.muted, shuffle: S.shuffle, repeat: S.repeat });
}, 300);
