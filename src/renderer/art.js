// Генеративные иконки: у каждого плейлиста, папки, микса и альбома свой рисунок.
// Рисунок определяется строкой (seed) и, при желании, видом (kind): одно и то же всегда даёт одно и то же.
import { S } from './state.js';

const hash = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const f = (n) => Math.round(n * 10) / 10;
// hsl -> rgb(): так рисунок выглядит одинаково в любом рендерере
const hsl = (h, sat, l) => {
  h = ((h % 360) + 360) % 360; sat /= 100; l /= 100;
  const a = sat * Math.min(l, 1 - l), k = (n) => (n + h / 30) % 12;
  const c = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return `rgb(${c(0)},${c(8)},${c(4)})`;
};

const palette = (hue, geo) => geo
  ? { geo: true, bgA: '#171717', bgB: '#0a0a0a', hi: '#ffffff', mid: 'rgba(255,255,255,.55)', shade: () => '#0e0e0e', edge: ' stroke="#fff" stroke-opacity=".3" stroke-width=".5"' }
  : {
      geo: false, bgA: hsl(hue, 16, 28), bgB: hsl(hue + 28, 14, 8),
      hi: hsl(hue, 34, 90), mid: hsl(hue, 24, 64),
      shade: (i) => hsl(hue, Math.max(6, 18 - i * 3), Math.max(6, 40 - i * 9)), edge: ''
    };

const FAMILIES = {
  ridges(R, p, rnd, low) {
    const cx = rnd(24, 76), cy = low ? rnd(44, 52) : rnd(16, 34), r = low ? rnd(13, 17) : rnd(6, 12);
    let s = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r + 9)}" fill="${p.hi}" opacity=".12"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${p.hi}" opacity=".94"/>`;
    for (let i = 0; i < 4; i++) {
      const base = 52 + i * 13, amp = 26 - i * 4, n = 6 + i;
      let pts = `0,100 0,${f(base - rnd(0, amp))}`;
      for (let k = 1; k <= n; k++) pts += ` ${f((k * 100) / n)},${f(base - rnd(0, amp))}`;
      pts += ' 100,100';
      s += p.geo
        ? `<polygon points="${pts}" fill="#0c0c0c" fill-opacity=".92" stroke="#fff" stroke-opacity="${f(0.9 - i * 0.18)}" stroke-width=".9"/>`
        : `<polygon points="${pts}" fill="${p.shade(i)}"/>`;
    }
    return s;
  },
  sunrise(R, p, rnd) { return FAMILIES.ridges(R, p, rnd, true); },
  bars(R, p, rnd) {
    const n = 11 + Math.floor(R() * 4), w = 100 / n, ph = rnd(0, 6), fq = rnd(0.5, 1.1);
    let s = '';
    for (let i = 0; i < n; i++) {
      const h = 14 + 56 * (0.5 + 0.5 * Math.sin(i * fq + ph)) * (0.6 + 0.4 * R());
      s += `<rect x="${f(i * w + w * 0.18)}" y="${f(86 - h)}" width="${f(w * 0.64)}" height="${f(h)}" rx="${f(w * 0.3)}" fill="${p.hi}" opacity="${f(0.35 + h / 90)}"/>`;
    }
    return s + `<rect x="6" y="90" width="88" height="1.6" fill="${p.hi}" opacity=".7"/>`;
  },
  rings(R, p, rnd) {
    const cx = rnd(30, 70), cy = rnd(30, 70), n = 5 + Math.floor(R() * 3);
    let s = '';
    for (let i = 0; i < n; i++) s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(6 + i * rnd(6.5, 8.5))}" fill="none" stroke="${i % 2 ? p.mid : p.hi}" stroke-width="${f(rnd(0.8, 3.2))}" opacity="${f(1 - i * 0.09)}"/>`;
    return s + `<circle cx="${f(cx)}" cy="${f(cy)}" r="3.2" fill="${p.hi}"/>`;
  },
  ripple(R, p) {
    let s = '';
    for (let i = 0; i < 7; i++) s += `<circle cx="50" cy="52" r="${f(5 + i * i * 1.15 + i * 3)}" fill="none" stroke="${p.hi}" stroke-width="${f(2.4 - i * 0.25)}" opacity="${f(0.95 - i * 0.13)}"/>`;
    return s;
  },
  dots(R, p, rnd) {
    const n = 8 + Math.floor(R() * 2), a = rnd(0, Math.PI * 2), st = 100 / n;
    let s = '';
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const t = Math.min(1, Math.max(0, ((i - n / 2) * Math.cos(a) + (j - n / 2) * Math.sin(a)) / n + 0.5));
      s += `<circle cx="${f(i * st + st / 2)}" cy="${f(j * st + st / 2)}" r="${f(0.6 + t * st * 0.42)}" fill="${p.hi}" opacity="${f(0.35 + t * 0.6)}"/>`;
    }
    return s;
  },
  dust(R, p) {
    const n = 9, st = 100 / n;
    let s = '';
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (R() > 1 - i / (n * 1.1)) continue;
      s += `<circle cx="${f(i * st + st / 2)}" cy="${f(j * st + st / 2)}" r="${f(0.8 + R() * 2.2 * (1 - i / n))}" fill="${p.hi}" opacity="${f(0.25 + 0.65 * (1 - i / n))}"/>`;
    }
    return s;
  },
  waves(R, p, rnd) {
    let s = '';
    const n = 8;
    for (let k = 0; k < n; k++) {
      const y0 = 24 + k * 9, amp = rnd(4, 14) * Math.sin(((k + 1) / (n + 1)) * Math.PI), ph = rnd(0, 6.28), fq = rnd(0.07, 0.13);
      let d = `M0 ${f(y0)}`;
      for (let x = 2; x <= 100; x += 2) d += ` L${x} ${f(y0 - amp * Math.sin(x * fq * 6 + ph) * Math.exp(-Math.pow((x - 50) / 38, 2)))}`;
      s += `<path d="${d} L100 100 L0 100Z" fill="${p.geo ? '#0c0c0c' : p.shade(2)}"/><path d="${d}" fill="none" stroke="${p.hi}" stroke-width="1.3" opacity="${f(0.5 + k * 0.06)}"/>`;
    }
    return s;
  },
  tri(R, p) {
    const n = 5, st = 100 / n;
    let s = '';
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = i * st, y = j * st, up = R() < 0.5;
      const a = up ? `${x},${y} ${x + st},${y} ${x},${y + st}` : `${x + st},${y} ${x + st},${y + st} ${x},${y + st}`;
      const b = up ? `${x + st},${y} ${x + st},${y + st} ${x},${y + st}` : `${x},${y} ${x + st},${y} ${x},${y + st}`;
      s += `<polygon points="${a}" fill="${p.hi}" opacity="${f(0.05 + R() * 0.5)}"${p.edge}/><polygon points="${b}" fill="${p.hi}" opacity="${f(0.05 + R() * 0.35)}"${p.edge}/>`;
    }
    return s;
  },
  arcs(R, p) {
    const n = 4, st = 25, h = st / 2;
    let s = '';
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = i * st, y = j * st;
      const d = R() < 0.5
        ? `M${x + h} ${y} A${h} ${h} 0 0 1 ${x} ${y + h} M${x + h} ${y + st} A${h} ${h} 0 0 1 ${x + st} ${y + h}`
        : `M${x + h} ${y} A${h} ${h} 0 0 0 ${x + st} ${y + h} M${x} ${y + h} A${h} ${h} 0 0 1 ${x + h} ${y + st}`;
      s += `<path d="${d}" fill="none" stroke="${p.hi}" stroke-width="3.2" stroke-linecap="round" opacity=".9"/>`;
    }
    return s;
  },
  sunset(R, p, rnd) {
    const cy = rnd(40, 52), dark = p.geo ? '#0b0b0b' : p.bgB;
    let s = `<circle cx="50" cy="${f(cy)}" r="23" fill="${p.hi}" opacity=".95"/>`;
    for (let i = 0; i < 6; i++) s += `<rect x="0" y="${f(cy + 4 + i * 6.5)}" width="100" height="${f(1.2 + i * 0.9)}" fill="${dark}"/>`;
    return s + `<rect x="0" y="${f(cy + 38)}" width="100" height="40" fill="${dark}"/>`;
  },
  nested(R, p, rnd) {
    const n = 7, rot = rnd(4, 11);
    let s = '';
    for (let i = 0; i < n; i++) {
      const sc = 44 - i * 5.6;
      s += `<rect x="${f(50 - sc)}" y="${f(50 - sc)}" width="${f(sc * 2)}" height="${f(sc * 2)}" fill="none" stroke="${i % 2 ? p.mid : p.hi}" stroke-width="1.4" transform="rotate(${f(i * rot)} 50 50)" opacity="${f(1 - i * 0.08)}"/>`;
    }
    return s;
  },
  burst(R, p, rnd) {
    const cx = rnd(0, 100), cy = R() < 0.5 ? 100 : 0, n = 14 + Math.floor(R() * 8);
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (i / (n - 1)) + (cy ? Math.PI : 0);
      s += `<line x1="${f(cx)}" y1="${cy}" x2="${f(cx + Math.cos(a) * 140)}" y2="${f(cy + Math.sin(a) * 140)}" stroke="${i % 3 ? p.mid : p.hi}" stroke-width="${f(0.6 + R() * 2.4)}" opacity=".85"/>`;
    }
    return s;
  },
  twin(R, p, rnd) {
    const r = rnd(20, 27);
    return [[40, 42], [60, 42], [50, 60]].map(([x, y], i) =>
      `<circle cx="${f(x + rnd(-6, 6))}" cy="${f(y + rnd(-6, 6))}" r="${f(r)}" fill="${i ? p.mid : p.hi}" opacity="${f(0.5 - i * 0.08)}"${p.geo ? ' stroke="#fff" stroke-width="1" fill-opacity=".1"' : ''}/>`).join('');
  },
  stairs(R, p, rnd) {
    const n = 6, w = 100 / n;
    let s = '', d = '';
    for (let i = 0; i < n; i++) {
      const h = 14 + i * 12 + rnd(-3, 5);
      s += `<rect x="${f(i * w + 2)}" y="${f(90 - h)}" width="${f(w - 4)}" height="${f(h)}" fill="${p.hi}" opacity="${f(0.3 + i * 0.12)}"/>`;
      d += `${i ? 'L' : 'M'}${f(i * w + w / 2)} ${f(90 - h - 5)} `;
    }
    return s + `<path d="${d}" fill="none" stroke="${p.hi}" stroke-width="1.6" stroke-linecap="round"/>`;
  },
  orbit(R, p, rnd) {
    let s = `<circle cx="50" cy="50" r="${f(rnd(9, 14))}" fill="${p.hi}"/>`;
    for (let i = 0; i < 3; i++) {
      const rot = rnd(0, 180), rx = 22 + i * 10, ry = 9 + i * 5;
      s += `<ellipse cx="50" cy="50" rx="${rx}" ry="${ry}" fill="none" stroke="${p.mid}" stroke-width="1.1" transform="rotate(${f(rot)} 50 50)"/><circle cx="${f(50 + rx)}" cy="50" r="${f(2 + R() * 2)}" fill="${p.hi}" transform="rotate(${f(rot)} 50 50)"/>`;
    }
    return s;
  },
  nightpeak(R, p, rnd) {
    let s = '';
    for (let i = 0; i < 26; i++) s += `<circle cx="${f(R() * 100)}" cy="${f(R() * 58)}" r="${f(0.4 + R() * 0.9)}" fill="${p.hi}" opacity="${f(0.3 + R() * 0.6)}"/>`;
    const px = rnd(34, 66), py = rnd(24, 38);
    s += `<polygon points="${f(px - 46)},100 ${f(px)},${f(py)} ${f(px + 46)},100" fill="${p.geo ? '#0c0c0c' : p.shade(2)}"${p.geo ? ' stroke="#fff" stroke-width=".9"' : ''}/>`;
    s += `<polygon points="${f(px - 12)},${f(py + 18)} ${f(px)},${f(py)} ${f(px + 12)},${f(py + 18)} ${f(px + 4)},${f(py + 15)} ${f(px)},${f(py + 20)} ${f(px - 5)},${f(py + 15)}" fill="${p.hi}" opacity=".85"/>`;
    return s;
  }
};

const GENERAL = ['ridges', 'bars', 'rings', 'dots', 'waves', 'tri', 'arcs', 'sunset', 'nested', 'burst', 'twin', 'orbit', 'nightpeak', 'stairs'];
const KIND = { daily: 'sunrise', forgotten: 'dust', top: 'stairs', recent: 'ripple', fav: 'twin' };
export const ART_FAMILIES = Object.keys(FAMILIES);

const cache = new Map();

// Возвращает готовое значение для CSS-свойства background.
export function artBg(seed, kind) {
  const geo = S.cfg.theme === 'geo';
  const key = `${geo ? 'g' : 'd'}|${kind || ''}|${seed}`;
  if (cache.has(key)) return cache.get(key);
  const x = hash(String(seed || '?'));
  const R = mulberry(x), rnd = (a, b) => a + (b - a) * R();
  const fam = KIND[kind] || GENERAL[x % GENERAL.length];
  const hue = kind === 'daily' ? 28 : x % 360;
  const p = palette(hue, geo);
  const body = FAMILIES[fam](R, p, rnd);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bgA}"/><stop offset="1" stop-color="${p.bgB}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/>${body}</svg>`;
  const css = `url("data:image/svg+xml,${encodeURIComponent(svg)}") center / cover no-repeat`;
  if (cache.size > 800) cache.clear();
  cache.set(key, css);
  return css;
}
