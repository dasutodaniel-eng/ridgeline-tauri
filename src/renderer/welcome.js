import { mascotSvg } from './mascot.js';
import { R, S, api } from './state.js';
import { h, nkey, setFill, tracksWord } from './util.js';
import { saveStats } from './store.js';
import { allLocal, artistList, trackPool } from './data.js';
import { GENRES, genreLabel, trackGenre } from './taste.js';
import { artBox } from './uikit.js';
import { addFolder } from './library.js';
import { closeMenu, ymModal } from './overlays.js';
import { renderSidebar } from './sidebar.js';
import { renderMain, tasteChips } from './pages.js';
import { startLine } from './line.js';
import { armIdle } from './ambient.js';

export const candArtists = (extra = []) => {
  const m = new Map();
  const add = (t) => {
    for (const a of artistList(t)) {
      const k = nkey(a.name); if (!k) continue;
      const e = m.get(k) || { k, name: a.name, n: 0, tracks: [] };
      e.n++; if (e.tracks.length < 1) e.tracks.push(t);
      m.set(k, e);
    }
  };
  for (const t of trackPool()) add(t);
  for (const t of R.likesCache || []) add(t);
  for (const t of S.stats.recent) add(t);
  const list = [...m.values()].sort((a, b) => b.n - a.n).slice(0, 36);
  for (const name of extra) { const k = nkey(name); if (!list.find((e) => e.k === k)) list.push({ k, name, n: 0, tracks: [] }); }
  return list;
};
export let welcomeApi = null;
export function openWelcome(opts = {}) {
  if (document.body.classList.contains('welcome')) return;
  document.body.classList.add('welcome');
  closeMenu();
  const ob = { i: 0, art: {}, genres: new Set(), lang: S.taste.lang || 'any', explore: S.stats.explore, extra: [] };
  for (const [k, w] of Object.entries(S.taste.artists)) if (Math.abs(w) >= 3) ob.art[k] = w > 0 ? 1 : -1;
  for (const [k, w] of Object.entries(S.taste.genres)) if (w >= 2) ob.genres.add(k);

  const el = h('div', 'wel'), stage = h('div', 'wel-stage'), bar = h('div', 'wel-bar');
  const dots = h('div', 'wel-dots'), cta = h('button', 'wel-cta', 'Продолжить'), back = h('button', 'wel-link', 'Назад');
  const skip = h('button', 'wel-skip', 'Пропустить');
  const TOTAL = 6;
  for (let i = 0; i < TOTAL; i++) dots.append(h('i'));
  bar.append(dots, cta, back);
  el.append(stage, bar, skip);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  const close = () => {
    el.classList.remove('in'); document.body.classList.remove('welcome'); welcomeApi = null;
    setTimeout(() => el.remove(), 500); armIdle();
  };

  // --- шаги ---
  const stepHero = () => {
    const d = h('div', 'wel-step');
    d.innerHTML = `<div class="wel-dasty">${mascotSvg({ cls: 'live' })}</div><h1 class="wel-brand">RIDGELINE</h1><p class="wel-sub">Музыка идёт по твоей линии.</p><p class="wel-small">Ответь на несколько вопросов, и Линия с подборками подстроятся под тебя. Это займёт минуту.</p>`;
    return d;
  };
  const stepSources = () => {
    const d = h('div', 'wel-step');
    d.append(h('h1', 'wel-h', 'Откуда берём музыку?'), h('p', 'wel-sub', 'Подключи один источник или оба. Можно и позже.'));
    const row = h('div', 'wel-cards');
    const mk = (title, getText, label, action) => {
      const c = h('div', 'wel-card'); const t = h('div', 'wc-t', title), s2 = h('div', 'wc-s'), b = h('button', 'btn', label);
      const upd = () => { s2.textContent = getText(); };
      b.onclick = async () => { b.disabled = true; try { await action(); } finally { b.disabled = false; upd(); } };
      upd(); c.append(t, s2, b); return c;
    };
    row.append(
      mk('Папка на компьютере', () => (allLocal().length ? `${tracksWord(allLocal().length)} в библиотеке` : 'Пока ничего не добавлено'), 'Выбрать папку', addFolder),
      mk('Яндекс Музыка', () => (S.ym.connected ? `Подключено: ${S.ym.login}` : 'Не подключена'), 'Подключить', async () => { await ymModal(); })
    );
    d.append(row);
    return d;
  };
  const stepArtists = () => {
    const d = h('div', 'wel-step');
    d.append(h('h1', 'wel-h', 'Кто тебе по душе?'), h('p', 'wel-sub', 'Нажми на тех, кого любишь. Второе нажатие значит «не хочу слышать», третье сбрасывает.'));
    const info = h('div', 'wel-small'), bubs = h('div', 'bubs');
    const build = () => {
      bubs.textContent = '';
      const list = candArtists(ob.extra);
      list.forEach((e, i) => {
        const b = h('button', 'bub' + (i < 8 ? ' lg' : ''));
        b.style.setProperty('--s', (i < 8 ? 96 : 72) + 'px');
        b.append(artBox(e.tracks, { round: true, seed: e.name }), h('span', '', e.name));
        const paint = () => { b.classList.toggle('love', ob.art[e.k] === 1); b.classList.toggle('avoid', ob.art[e.k] === -1); };
        b.onclick = () => { const st = ob.art[e.k]; if (st === undefined) ob.art[e.k] = 1; else if (st === 1) ob.art[e.k] = -1; else delete ob.art[e.k]; paint(); count(); };
        paint(); bubs.append(b);
      });
      if (!list.length) bubs.append(h('p', 'wel-small', 'Пока некого показать. Добавь музыку на прошлом шаге или впиши исполнителей ниже.'));
      count();
    };
    const count = () => {
      const l = Object.values(ob.art).filter((v) => v === 1).length, a = Object.values(ob.art).filter((v) => v === -1).length;
      info.textContent = `Любимых: ${l}${a ? `  ·  исключено: ${a}` : ''}`;
    };
    const add = h('div', 'wel-add');
    const inp = h('input'); inp.type = 'text'; inp.placeholder = 'Добавить исполнителя вручную'; inp.spellcheck = false;
    const addBtn = h('button', 'btn', 'Добавить');
    const submit = () => { const v = inp.value.trim(); if (!v) return; ob.extra.push(v); ob.art[nkey(v)] = 1; S.taste.names[nkey(v)] = v; inp.value = ''; build(); };
    addBtn.onclick = submit; inp.onkeydown = (e) => { if (e.key === 'Enter') { e.stopPropagation(); submit(); } };
    add.append(inp, addBtn);
    d.append(bubs, info, add);
    build();
    if (S.ym.connected && !R.likesCache) api.ym.likes().then((l) => { R.likesCache = l; if (d.isConnected) build(); }).catch(() => {});
    return d;
  };
  const stepGenres = () => {
    const d = h('div', 'wel-step');
    d.append(h('h1', 'wel-h', 'Что звучит в твоей голове?'), h('p', 'wel-sub', 'Выбери жанры, которые любишь. Те, что есть в твоей музыке, идут первыми.'));
    const cnt = new Map();
    for (const t of [...trackPool(), ...(R.likesCache || [])]) { const g = trackGenre(t); if (g) cnt.set(g, (cnt.get(g) || 0) + 1); }
    const mine = [...cnt.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const order = [...mine, ...GENRES.map((g) => g[0]).filter((k) => !mine.includes(k))];
    const wrap = h('div', 'pills');
    for (const k of order) {
      const b = h('button', 'pill' + (ob.genres.has(k) ? ' on' : ''), genreLabel(k));
      b.onclick = () => { if (ob.genres.has(k)) ob.genres.delete(k); else ob.genres.add(k); b.classList.toggle('on', ob.genres.has(k)); };
      wrap.append(b);
    }
    d.append(wrap);
    if (!mine.length) d.append(h('p', 'wel-small', 'В тегах твоих файлов жанров не нашлось: ответы всё равно сработают для треков из Яндекса и новых файлов с жанрами.'));
    return d;
  };
  const stepLang = () => {
    const d = h('div', 'wel-step');
    d.append(h('h1', 'wel-h', 'Язык и новизна'), h('p', 'wel-sub', 'Какую музыку чаще ставить и сколько в ней должно быть нового.'));
    const opts = h('div', 'wel-cards');
    [['ru', 'Русская', 'Чаще русскоязычное'], ['other', 'Зарубежная', 'Чаще на других языках'], ['any', 'Всё подряд', 'Язык не важен']].forEach(([k, t, s2]) => {
      const c = h('button', 'wel-card opt' + (ob.lang === k ? ' on' : ''));
      c.append(h('div', 'wc-t', t), h('div', 'wc-s', s2));
      c.onclick = () => { ob.lang = k; opts.querySelectorAll('.opt').forEach((x) => x.classList.toggle('on', x === c)); };
      opts.append(c);
    });
    const sl = h('div', 'slider wide'); const lb = h('div', 'lbls'); lb.append(h('span', '', 'Больше привычного'), h('span', '', 'Больше нового'));
    const rg = h('input', 'range'); rg.type = 'range'; rg.min = 0; rg.max = 100; rg.value = Math.round(ob.explore * 100); setFill(rg);
    rg.oninput = () => { ob.explore = rg.value / 100; setFill(rg); };
    sl.append(lb, rg);
    d.append(opts, sl);
    return d;
  };
  const stepDone = () => {
    const d = h('div', 'wel-step');
    { const m = h('div', 'wel-dasty small'); m.innerHTML = mascotSvg({ mood: 'wink', cls: 'live' }); d.append(m); }
      d.append(h('h1', 'wel-h', 'Готово'), h('p', 'wel-sub', 'Линия и подборки настроены. Дальше она учится на твоих лайках и пропусках.'));
    d.append(tasteChips());
    d.append(h('p', 'wel-small', 'Сердечко учит Линию, кнопка «не моё» в плеере убирает исполнителя из подбора. Настроить заново можно в «Настройки».'));
    return d;
  };
  const steps = [stepHero, stepSources, stepArtists, stepGenres, stepLang, stepDone];
  const labels = ['Начать', 'Продолжить', 'Продолжить', 'Продолжить', 'Готово', 'Включить Линию'];

  const apply = () => {
    const keys = new Set([...Object.keys(ob.art), ...candArtists(ob.extra).map((e) => e.k)]);
    for (const e of candArtists(ob.extra)) S.taste.names[e.k] = e.name;
    for (const k of keys) {
      const st = ob.art[k], cw = S.taste.artists[k] || 0;
      if (st === 1) S.taste.artists[k] = Math.max(cw, 4);
      else if (st === -1) S.taste.artists[k] = -4;
      else if (Math.abs(cw) >= 3) S.taste.artists[k] = 0;
    }
    for (const [k] of GENRES) {
      const cw = S.taste.genres[k] || 0;
      if (ob.genres.has(k)) S.taste.genres[k] = Math.max(cw, 3);
      else if (cw >= 2) S.taste.genres[k] = 0;
    }
    S.taste.lang = ob.lang; S.stats.explore = ob.explore;
    S.taste.done = true; S.taste.skipped = false;
    saveStats(); renderSidebar(); renderMain();
  };
  const go = (i) => {
    ob.i = i; stage.textContent = ''; stage.append(steps[i]());
    dots.querySelectorAll('i').forEach((x, k) => x.classList.toggle('on', k === i));
    cta.textContent = labels[i];
    back.style.visibility = i > 0 && i < TOTAL - 1 ? 'visible' : 'hidden';
    skip.style.display = i < TOTAL - 1 ? '' : 'none';
    back.textContent = i === TOTAL - 1 ? '' : 'Назад';
    stage.scrollTop = 0;
  };
  const advance = () => {
    if (ob.i === TOTAL - 2) { apply(); go(TOTAL - 1); return; }
    if (ob.i === TOTAL - 1) { close(); startLine(null, opts.mode); return; }
    go(ob.i + 1);
  };
  cta.onclick = advance;
  back.onclick = () => { if (ob.i > 0) go(ob.i - 1); };
  skip.onclick = () => { S.taste.skipped = true; saveStats(); close(); };
  welcomeApi = { next: advance, back: () => { if (ob.i > 0 && ob.i < TOTAL - 1) go(ob.i - 1); } };
  go(0);
}
