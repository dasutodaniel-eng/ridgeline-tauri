import { S, audio, cur } from './state.js';
import { h } from './util.js';
import { closeMenu, modalEl } from './overlays.js';

export const amb = h('div', 'ambient');
amb.innerHTML = '<div><div class="am-day"></div><div class="am-date"></div><div class="am-time"></div><div class="am-track"></div><div class="am-bar"><i></i></div></div><div class="am-hint">ESC · ВЫЙТИ     F · НА ВЕСЬ ЭКРАН     ПРОБЕЛ · ПАУЗА</div>';
document.body.append(amb);
export let ambTimer = null, ambientMode = 'manual', ambientSince = 0, lastMx = 0, lastMy = 0, entryX = 0, entryY = 0;
export function updateAmbientText() {
  const t = cur();
  amb.querySelector('.am-track').textContent = t ? `${t.artist ? t.artist + '  —  ' : ''}${t.title}` : 'ТИШИНА';
}
export function tickAmbient() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  amb.querySelector('.am-day').textContent = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  amb.querySelector('.am-date').textContent = `${p(d.getDate())} ${d.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()}, ${d.getFullYear()}.`;
  amb.querySelector('.am-time').textContent = `- ${p(d.getHours())}:${p(d.getMinutes())} -`;
}
export function showAmbient(mode = 'manual') {
  if (document.body.classList.contains('welcome')) return;
  closeMenu(); modalEl.classList.remove('open');
  tickAmbient(); updateAmbientText();
  clearInterval(ambTimer); ambTimer = setInterval(tickAmbient, 1000);
  ambientMode = mode; ambientSince = performance.now(); entryX = lastMx; entryY = lastMy;
  document.body.classList.add('ambient');
}
export function hideAmbient() {
  document.body.classList.remove('ambient');
  clearInterval(ambTimer);
  armIdle();
}
export let idleT;
export function armIdle() {
  clearTimeout(idleT);
  if (!S.stats.ambientAuto) return;
  idleT = setTimeout(() => { if (!document.body.classList.contains('ambient') && !document.body.classList.contains('welcome') && !audio.paused) showAmbient('auto'); }, 120000);
}
amb.addEventListener('click', () => { if (performance.now() - ambientSince > 350) hideAmbient(); });

// параллакс сцены + активность
export let pxRaf = 0;
document.addEventListener('mousemove', (e) => {
  lastMx = e.clientX; lastMy = e.clientY;
  if (!pxRaf) pxRaf = requestAnimationFrame(() => {
    pxRaf = 0;
    const k = document.body.classList.contains('ambient') ? 2.4 : 1;
    document.body.style.setProperty('--px', (((lastMx / innerWidth) - 0.5) * 2 * k).toFixed(3));
    document.body.style.setProperty('--py', (((lastMy / innerHeight) - 0.5) * 2 * k).toFixed(3));
  });
  if (document.body.classList.contains('ambient')) {
    if (ambientMode === 'auto' && performance.now() - ambientSince > 2000 && Math.hypot(e.clientX - entryX, e.clientY - entryY) > 90) hideAmbient();
  } else armIdle();
}, true);
['mousedown', 'wheel', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { if (!document.body.classList.contains('ambient')) armIdle(); }, true));
