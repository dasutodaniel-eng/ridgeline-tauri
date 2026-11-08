// Источники музыки. Чтобы добавить новый (YouTube Music, SoundCloud…), достаточно:
//   1) описать его здесь: id, label, badge, lazy и resolve(track) -> { url, preview? };
//   2) дать ему модуль в основном процессе (как yandex.js) и IPC-вызовы в preload.js.
// Треки несут поле src, поэтому плейлисты из нескольких источников работают без доработок.
import { api } from '../state.js';

export const SOURCES = {
  local: {
    id: 'local', label: 'Файлы', badge: '',
    lazy: false,                       // ссылку не нужно получать заранее
    async resolve(t) { return { url: t.url }; }
  },
  ym: {
    id: 'ym', label: 'Яндекс Музыка', badge: 'Я',
    lazy: true,                        // ссылки живут недолго: получаем в момент воспроизведения
    async resolve(t) { const r = await api.ym.url(t.ymId); return { url: r.url, preview: !!r.preview }; }
  }
};

SOURCES.sc = {
  id: 'sc', label: 'SoundCloud', badge: 'SC',
  lazy: true,
  async resolve(t) { const r = await api.sc.url(t.scId); return { url: r.url, hls: !!r.hls, preview: !!r.preview }; }
};

export const sourceOf = (t) => SOURCES[t && t.src] || SOURCES.local;
