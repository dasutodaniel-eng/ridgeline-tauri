import { S } from './state.js';
import { h, setFill, toast } from './util.js';
import { saveStats } from './store.js';
import { applyCfg, setTheme } from './theme.js';
import { confirmBox, modal } from './overlays.js';
import { syncLikes } from './account.js';
import { renderSidebar } from './sidebar.js';
import { renderMain } from './pages.js';
import { openWelcome } from './welcome.js';
import { armIdle } from './ambient.js';

export const settingsModal = () => modal((card, close) => {
  card.append(h('h3', '', 'Настройки'));
  const group = (label) => { const g = h('div', 'sgrp'); g.append(h('div', 'slbl', label)); card.append(g); return g; };
  const swRow = (g, label, on, fn) => {
    const r = h('div', 'srow'); r.append(h('span', '', label));
    const b = h('button', 'switch' + (on ? ' on' : '')); b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(on));
    b.onclick = () => { on = !on; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); fn(on); };
    r.append(b); g.append(r);
  };
  const g1 = group('Стиль');
  const seg = h('div', 'seg');
  [['depth', 'Глубина'], ['geo', 'Геометрия']].forEach(([k, l]) => {
    const b = h('button', S.cfg.theme === k ? 'on' : '', l);
    b.onclick = () => { setTheme(k); seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    seg.append(b);
  });
  g1.append(seg);
  const g2 = group('Матовость панелей');
  const rg = h('input', 'range'); rg.type = 'range'; rg.min = 0; rg.max = 100; rg.value = S.cfg.matte; setFill(rg);
  rg.oninput = () => { S.cfg.matte = +rg.value; setFill(rg); applyCfg(); saveStats(); };
  g2.append(rg, h('div', 'shint', 'Меньше: панели прозрачнее, хребты на фоне виднее'));
  const g3 = group('Ambient');
  swRow(g3, 'Включаться самому после 2 минут простоя', S.stats.ambientAuto, (v) => { S.stats.ambientAuto = v; saveStats(); armIdle(); });
  const g6 = group('SoundCloud');
  swRow(g6, 'Искать в SoundCloud', S.cfg.scSearch, (v) => { S.cfg.scSearch = v; saveStats(); });
  g6.append(h('div', 'shint', 'Неофициальный доступ: работает без входа, но может перестать работать при изменениях на сайте.'));
  const g5 = group('Вкус');
  const tb = h('button', 'btn', 'Настроить заново');
  tb.onclick = () => { close(true); openWelcome({}); };
  const tr = h('button', 'btn', 'Сбросить вкус');
  tr.onclick = async () => {
    close(true);
    if (await confirmBox('Сбросить вкус?', 'Лайки, пропуски и ответы с приветственного экрана будут забыты. Библиотека останется.', 'Сбросить')) {
      S.taste = { done: false, skipped: false, artists: {}, genres: {}, tracks: {}, names: {}, lang: 'any' };
      saveStats(); renderSidebar(); renderMain(); toast('Вкус сброшен');
    }
  };
  const trow = h('div', 'btnrow'); trow.append(tb, tr); g5.append(trow);
  g5.append(h('div', 'shint', 'Линия, подборки и миксы строятся по этому профилю.'));
  const g4 = group('Яндекс Музыка');
  if (S.ym.connected) {
    const status = h('div', 'shint', S.sync.msg ? 'Последняя синхронизация: ' + S.sync.msg : 'Ещё не синхронизировалось');
    swRow(g4, 'Синхронизировать лайки', S.cfg.syncLikes, (v) => { S.cfg.syncLikes = v; saveStats(); if (v) syncLikes(true); });
    const b = h('button', 'btn', 'Синхронизировать сейчас');
    b.onclick = async () => { b.disabled = true; status.textContent = 'Синхронизирую…'; await syncLikes(true); status.textContent = 'Последняя синхронизация: ' + (S.sync.msg || '—'); b.disabled = false; };
    g4.append(b, status);
    g4.append(h('div', 'shint', 'Двусторонняя: новые лайки уходят в Яндекс и приходят из него. Локальные файлы остаются только у тебя.'));
  } else g4.append(h('div', 'shint', 'Подключи Яндекс Музыку в сайдбаре, чтобы лайки синхронизировались.'));
  const ok = h('button', 'btn primary', 'Готово'); ok.onclick = () => close(true);
  const row = h('div', 'btns'); row.append(ok); card.append(row);
});
