import { $, S } from './state.js';
import { closeMenu } from './overlays.js';
import { renderSidebar } from './sidebar.js';
import { renderMain } from './pages.js';

export const viewKey = (v) => JSON.stringify(v);
export const updateNavButtons = () => {
  $('#btnBack').disabled = S.nav.pos <= 0;
  $('#btnFwd').disabled = S.nav.pos >= S.nav.stack.length - 1;
};
export const showView = (v) => { S.view = v; closeMenu(); renderSidebar(); renderMain(); updateNavButtons(); };
export function openView(v) {
  const n = S.nav, last = n.stack[n.pos];
  if (!(last && viewKey(last) === viewKey(v))) {
    if (last && last.type === 'search' && v.type === 'search') n.stack[n.pos] = v;
    else { n.stack = n.stack.slice(0, n.pos + 1); n.stack.push(v); n.pos++; if (n.stack.length > 60) { n.stack.shift(); n.pos--; } }
  }
  showView(v);
}
export const goBack = () => { if (S.nav.pos > 0) { S.nav.pos--; showView(S.nav.stack[S.nav.pos]); } };
export const goFwd = () => { if (S.nav.pos < S.nav.stack.length - 1) { S.nav.pos++; showView(S.nav.stack[S.nav.pos]); } };
