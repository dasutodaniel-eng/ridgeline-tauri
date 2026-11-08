// Мост на Tauri: повторяет preload.js из Electron-версии один в один,
// чтобы модули renderer/ не отличались. Грузится как обычный скрипт до ES-модулей.
(() => {
  const { invoke, convertFileSrc } = window.__TAURI__.core;
  const ev = window.__TAURI__.event;
  const win = window.__TAURI__.window.getCurrentWindow();

  // треки из старой Electron-библиотеки несут file://-ссылки: переводим в media://
  const fixUrls = (v) => {
    if (typeof v === 'string') {
      if (v.startsWith('file://')) {
        try {
          const p = decodeURIComponent(v.replace(/^file:\/\/\//, ''));
          return convertFileSrc(p, 'media');
        } catch { return v; }
      }
      return v;
    }
    if (Array.isArray(v)) return v.map(fixUrls);
    if (v && typeof v === 'object') { for (const k in v) v[k] = fixUrls(v[k]); }
    return v;
  };

  const ymCall = (name, args) => invoke(name, args); // ошибки уже в формате сообщений
  window.api = {
    expand: (paths) => invoke('fs_expand', { paths }).then((r) => r.map((f) => ({ ...f, url: convertFileSrc(f.path, 'media') }))),
    pickFiles: () => invoke('dialog_files'),
    pickFolder: () => invoke('dialog_folder'),
    describe: (paths) => invoke('meta_describe', { paths }),
    cover: (p) => invoke('meta_cover', { path: p }),
    load: (name) => invoke('store_load', { name }).then((d) => (d ? fixUrls(d) : null)),
    save: (name, data) => invoke('store_save', { name, data }),
    launchPaths: () => invoke('launch_paths'),
    pathFor: () => null, // пути дропов приходит событием ridgeline:open
    platform: navigator.platform.includes('Mac') ? 'darwin' : 'win32',
    win: async (a) => {
      if (a === 'min') win.minimize();
      else if (a === 'max') await (await win.isMaximized() ? win.unmaximize() : win.maximize());
      else if (a === 'close') win.close();
      else if (a === 'full') await win.setFullscreen(!await win.isFullscreen());
    },
    onOpen: (cb) => ev.listen('ridgeline:open', (e) => cb(e.payload || [])),
    sc: {
      search: (q) => ymCall('sc_search', { q }),
      charts: () => ymCall('sc_charts'),
      resolve: (url) => ymCall('sc_resolve', { url }),
      artist: (id) => ymCall('sc_artist', { id }),
      url: (id) => ymCall('sc_url', { id })
    },
    ym: {
      status: () => ymCall('ym_status'),
      login: () => ymCall('ym_login'),
      setToken: (t, k) => ymCall('ym_set_token', { token: t, signKey: k }),
      logout: () => ymCall('ym_logout'),
      likes: () => ymCall('ym_likes'),
      playlists: () => ymCall('ym_playlists'),
      playlist: (uid, kind) => ymCall('ym_playlist', { uid, kind }),
      search: (q) => ymCall('ym_search', { q }),
      like: (ids, on) => ymCall('ym_like', { ids, on }),
      artist: (id) => ymCall('ym_artist', { id }),
      album: (id) => ymCall('ym_album', { id }),
      similar: (id) => ymCall('ym_similar', { id }),
      url: (id) => ymCall('ym_url', { id })
    }
  };

  // HLS-потоки SoundCloud без CORS-хаков Electron: все запросы hls.js
  // гоняем через встроенный scproxy://-протокол (бэкенд стримит с RANGE).
  const Hls = window.Hls;
  if (Hls) {
    const b64url = (s) => {
      const b = new TextEncoder().encode(s);
      let u = '';
      for (const c of b) u += String.fromCharCode(c);
      return btoa(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    const proxied = (u) => convertFileSrc(b64url(u), 'scproxy');
    const isSc = (u) => /^https?:\/\//.test(u) && /sndcdn\.com|soundcloud/i.test(u);
    const Base = Hls.DefaultConfig.loader;
    class ThroughProxy extends Base {
      load(context, cb, onProgress) {
        if (isSc(context.url)) context.url = proxied(context.url);
        return super.load(context, cb, onProgress);
      }
    }
    Hls.DefaultConfig.loader = ThroughProxy;
  }
})();
