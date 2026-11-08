// Заставка при каждом запуске: «хребет» вырастает из столбиков, Дасти надевает наушники и просыпается.
import { mascotSvg } from './mascot.js';

const BARS = [70, 118, 176, 132, 226, 300, 236, 172, 246, 150, 104, 140, 82];
const el = document.querySelector('#splash');
const t0 = performance.now();
const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (el) {
  let bars = '';
  BARS.forEach((h, i) => { bars += `<rect style="--i:${i}" x="${i * 28}" y="${300 - h}" width="18" height="${h}" rx="9"/>`; });
  el.innerHTML = `
    <div class="sp-ridge"><svg viewBox="-6 0 380 310" preserveAspectRatio="xMidYMax meet">${bars}</svg></div>
    <div class="sp-center">
      <div class="sp-dasty">${mascotSvg({ cls: 'live' })}</div>
      <div class="sp-brand">RIDGELINE</div>
      <div class="sp-bar"><i></i></div>
    </div>`;
}

let hidden = false;
export function hideSplash() {
  if (hidden || !el) return;
  hidden = true;
  const wait = reduced ? 200 : Math.max(0, 2500 - (performance.now() - t0));
  setTimeout(() => {
    el.classList.add('out');
    document.body.classList.add('intro');
    setTimeout(() => { el.remove(); document.body.classList.remove('intro'); }, 1200);
  }, wait);
}
setTimeout(hideSplash, 7000);   // страховка: заставка не должна зависнуть
