// Дасти: маскот Ridgeline (от Dasuto, «пыль»). Тёмный комочек в наушниках с планшетом.
// Настроения: happy, sleepy, wow, wink. Анимации (моргание, нота, качание под музыку) описаны в style.css.
const EYES = {
  happy: '<path d="M160 192 Q190 148 222 186"/><path d="M255 180 Q286 136 318 168"/>',
  sleepy: '<path d="M160 184 Q190 202 222 184"/><path d="M255 172 Q286 190 318 172"/>',
  wink: '<path d="M160 192 Q190 148 222 186"/><path d="M258 170 H318"/>',
  wow: '<circle cx="192" cy="178" r="13"/><circle cx="288" cy="166" r="13"/><ellipse cx="240" cy="210" rx="8" ry="10"/>'
};

export const mascotSvg = ({ mood = 'happy', note = true, laptop = true, body = true, view = '0 0 520 380', cls = '' } = {}) => {
  let s = `<svg class="dasty ${cls}" viewBox="${view}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;
  s += '<ellipse class="shadow" cx="262" cy="372" rx="196" ry="8" fill="#000" opacity=".35"/>';
  if (body) s += '<path class="body" d="M70 366 C76 322 108 286 160 282 L264 290 L264 366 Z" fill="#232323"/>';
  s += '<g class="head-g">';
  s += '<ellipse class="ear-r" cx="352" cy="150" rx="31" ry="57" transform="rotate(12 352 150)" fill="#424242"/>';
  s += '<rect class="head" x="105" y="75" width="275" height="165" rx="42" fill="#161616" stroke="#ffffff" stroke-opacity=".09" stroke-width="2" transform="rotate(-3 242 157)"/>';
  s += '<path class="band" d="M52 108 C70 42 130 12 200 12 C266 14 312 46 324 92" fill="none" stroke="#666" stroke-width="21" stroke-linecap="round"/>';
  s += '<ellipse class="ear-l" cx="58" cy="198" rx="42" ry="63" transform="rotate(-10 58 198)" fill="#626262"/>';
  s += `<g class="eyes">${EYES[mood] || EYES.happy}</g>`;
  s += '</g>';
  if (laptop) {
    s += '<g class="laptop"><path d="M272 234 L448 226 L408 356 L258 332 Z" fill="#2a2a2a" stroke="#2a2a2a" stroke-width="14" stroke-linejoin="round"/>';
    s += '<path d="M284 246 L436 239 L403 340 L272 320 Z" fill="#1c1c1c"/><path d="M272 233 L448 225" stroke="#454545" stroke-width="5" stroke-linecap="round" opacity=".8"/>';
    s += '<g transform="rotate(-8 340 294)" fill="none" stroke="#7a7a7a" stroke-width="3" stroke-linejoin="round"><rect x="318" y="272" width="44" height="44" rx="4"/><path d="M340 272 V316 M318 294 H362"/><rect x="326" y="280" width="14" height="14" rx="2" opacity=".7"/><rect x="340" y="294" width="14" height="14" rx="2" opacity=".7"/></g></g>';
  }
  if (note && mood !== 'sleepy') {
    s += '<g class="note" fill="#fff"><ellipse cx="426" cy="92" rx="14" ry="11" transform="rotate(-18 426 92)"/><ellipse cx="482" cy="99" rx="14" ry="11" transform="rotate(-18 482 99)"/>';
    s += '<path d="M437 90 V32 L493 20 V98" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/><path d="M437 34 L493 22 V44 L437 56 Z"/></g>';
  }
  if (mood === 'sleepy') s += '<g class="zz" fill="#9a9a9a" font-family="sans-serif" font-weight="700"><text x="392" y="70" font-size="34">z</text><text x="430" y="40" font-size="26">z</text></g>';
  return s + '</svg>';
};

// Только голова в наушниках: метка в заголовке окна
export const mascotMark = () => mascotSvg({ note: false, laptop: false, body: false, view: '20 0 380 262', cls: 'mini live' });
