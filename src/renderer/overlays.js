import { $, S, api } from './state.js';
import { errText, h, toast } from './util.js';
import { refreshYm } from './account.js';

export const menu = $('#menu');
export const closeMenu = () => menu.classList.remove('open');
export const showMenu = (x, y, items) => {
  menu.textContent = '';
  for (const it of items) {
    if (it.sep) { menu.append(h('div', 'sep')); continue; }
    if (it.head) { menu.append(h('div', 'mh', it.head)); continue; }
    const b = h('button', '', it.label);
    b.onclick = () => { closeMenu(); it.fn && it.fn(); };
    menu.append(b);
  }
  menu.classList.add('open');
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
};
document.addEventListener('mousedown', (e) => { if (!menu.contains(e.target)) closeMenu(); });
window.addEventListener('blur', closeMenu);

export const modalEl = $('#modal');
export const modal = (build) => new Promise((resolve) => {
  modalEl.textContent = '';
  const card = h('div', 'card');
  modalEl.append(card);
  modalEl.classList.add('open');
  const close = (v) => { modalEl.classList.remove('open'); modalEl.textContent = ''; resolve(v); };
  modalEl.onmousedown = (e) => { if (e.target === modalEl) close(null); };
  build(card, close);
});
export const askText = (title, value = '', okLabel = 'Готово') => modal((card, close) => {
  card.append(h('h3', '', title));
  const inp = h('input'); inp.type = 'text'; inp.value = value; inp.spellcheck = false;
  const ok = h('button', 'btn primary', okLabel), no = h('button', 'btn', 'Отмена');
  const submit = () => { const v = inp.value.trim(); if (v) close(v); };
  ok.onclick = submit; no.onclick = () => close(null);
  inp.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  const row = h('div', 'btns'); row.append(no, ok);
  card.append(inp, row);
  setTimeout(() => { inp.focus(); inp.select(); }, 30);
});
export const confirmBox = (title, text, okLabel) => modal((card, close) => {
  card.append(h('h3', '', title), h('p', '', text));
  const ok = h('button', 'btn primary', okLabel), no = h('button', 'btn', 'Отмена');
  ok.onclick = () => close(true); no.onclick = () => close(false);
  const row = h('div', 'btns'); row.append(no, ok);
  card.append(row);
});
export const ymModal = () => modal((card, close) => {
  card.append(h('h3', '', 'Яндекс Музыка'));
  card.append(h('p', '', 'Неофициальное подключение через закрытый API Яндекса. Полные треки доступны только с подпиской Плюс, без неё приходят 30-секундные фрагменты.'));
  const err = h('div', 'err');
  const done = async (st) => {
    if (st.connected) { S.ym = { ...S.ym, ...st }; close(true); await refreshYm(); toast(`Подключено: ${st.login}`); }
    else err.textContent = st.error || 'Не удалось подключиться';
  };
  const login = h('button', 'btn primary wide', 'Войти через Яндекс');
  login.onclick = async () => {
    err.textContent = ''; login.disabled = true; login.textContent = 'Жду вход…';
    try { await done(await api.ym.login()); } catch (e) { err.textContent = errText(e); }
    login.disabled = false; login.textContent = 'Войти через Яндекс';
  };
  card.append(login, h('div', 'or', 'или вставь токен вручную'));
  const tok = h('input'); tok.type = 'password'; tok.placeholder = 'OAuth-токен'; tok.spellcheck = false;
  const det = h('details'); det.append(h('summary', '', 'Дополнительно'));
  const key = h('input'); key.type = 'text'; key.placeholder = 'Ключ подписи (оставь пустым по умолчанию)';
  det.append(key);
  const ok = h('button', 'btn primary', 'Подключить'), no = h('button', 'btn', 'Закрыть');
  ok.onclick = async () => {
    err.textContent = '';
    if (!tok.value.trim()) { err.textContent = 'Вставь токен'; return; }
    try { await done(await api.ym.setToken(tok.value, key.value)); } catch (e) { err.textContent = errText(e); }
  };
  no.onclick = () => close(null);
  const row = h('div', 'btns'); row.append(no, ok);
  card.append(tok, det, err, row);
});
