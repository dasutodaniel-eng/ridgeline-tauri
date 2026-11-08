import { hideSplash } from './splash.js';
import { mascotMark } from './mascot.js';
import { S, api } from './state.js';
import { setFill } from './util.js';
import { applyCfg } from './theme.js';
import { backfillGenres } from './library.js';
import { updateNavButtons } from './nav.js';
import { refreshYm } from './account.js';
import { renderSidebar } from './sidebar.js';
import { renderMain } from './pages.js';
import { openLoose } from './queue.js';
import { openWelcome } from './welcome.js';
import { applyVolume, playIndex, seek, setRepeat, setShuffle } from './player.js';
import { armIdle } from './ambient.js';
import './wiring.js';

if (api.platform === 'darwin') document.body.classList.add('mac');
const brandMark = document.querySelector('#brandMark');
if (brandMark) brandMark.innerHTML = mascotMark();

(async () => {
  setFill(seek);
  const lib = await api.load('library');
  if (lib) S.lib = { folders: lib.folders || [], playlists: lib.playlists || [], favorites: lib.favorites || [] };
  const st = await api.load('stats');
  if (st) {
    S.stats = { counts: st.counts || {}, recent: st.recent || [], explore: typeof st.explore === 'number' ? st.explore : 0.35, ambientAuto: st.ambientAuto !== false };
    if (st.taste) S.taste = { ...S.taste, ...st.taste, names: st.taste.names || {} };
    if (st.cfg) { S.cfg = { ...S.cfg, ...st.cfg }; S.seen = new Set(st.cfg.ymSeen || []); delete S.cfg.ymSeen; }
  }
  applyCfg();
  const pb = await api.load('playback');
  if (pb) {
    S.volume = typeof pb.volume === 'number' ? pb.volume : 0.8;
    S.muted = !!pb.muted;
    setShuffle(!!pb.shuffle); setRepeat(pb.repeat || 'off');
  }
  applyVolume(); updateNavButtons();
  renderSidebar(); renderMain();
  hideSplash();
  refreshYm();
  armIdle();
  backfillGenres();
  if (!S.taste.done && !S.taste.skipped) setTimeout(() => openWelcome({}), 450);

  const launch = await api.launchPaths();
  if (launch.length) return openLoose(launch, true);

  const q = await api.load('queue');
  if (q && q.length) {
    S.queue = q;
    const i = Math.max(0, S.queue.findIndex((t) => t.id === (pb && pb.current)));
    playIndex(i, { autoplay: false, at: (pb && pb.time) || 0 });
  }
})();
