import { S, cur } from './state.js';
import { hash } from './util.js';
import { saveStats } from './store.js';
import { renderSidebar } from './sidebar.js';
import { renderMain } from './pages.js';
import { curCoverUrl, setPCover } from './player.js';

export const applyCfg = () => {
  const b = document.body;
  b.dataset.theme = S.cfg.theme;
  b.style.setProperty('--pa', (0.14 + S.cfg.matte * 0.0058).toFixed(2));
  b.style.setProperty('--bl', Math.round(S.cfg.matte * 0.24) + 'px');
};
export const setTheme = (k) => {
  S.cfg.theme = k; applyCfg(); saveStats();
  renderSidebar(); renderMain();
  if (cur()) setPCover(curCoverUrl);
};

export const hsl2rgb = (hh, s, l) => {
  const k = (n) => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};
export const setTint = (rgb) => {
  const b = document.body.style;
  b.setProperty('--tr', rgb[0]); b.setProperty('--tg', rgb[1]); b.setProperty('--tb', rgb[2]);
};
export const extractTint = (url) => new Promise((res) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 16;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, 16, 16);
      const d = x.getImageData(0, 0, 16, 16).data;
      let r = 0, g = 0, b = 0, w = 0;
      for (let i = 0; i < d.length; i += 4) {
        const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
        const wt = 0.2 + ((mx - mn) / (mx || 1)) * 2;
        r += d[i] * wt; g += d[i + 1] * wt; b += d[i + 2] * wt; w += wt;
      }
      r /= w; g /= w; b /= w;
      const k = 170 / (Math.max(r, g, b) || 1);
      res([Math.round(r * k * 0.8 + 26), Math.round(g * k * 0.8 + 26), Math.round(b * k * 0.8 + 26)]);
    } catch { res(null); }
  };
  img.onerror = () => res(null);
  img.src = url;
});
export let tintToken = 0;
export const updateTint = async (t, url) => {
  const tok = ++tintToken;
  let rgb = url ? await extractTint(url) : null;
  if (tok !== tintToken) return;
  if (!rgb) rgb = t ? hsl2rgb(hash((t.artist || '') + t.title) % 360, 0.28, 0.5) : [120, 120, 120];
  setTint(rgb);
};
