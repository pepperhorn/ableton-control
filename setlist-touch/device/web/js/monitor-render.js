import {monitorView} from './monitor-view.js';
const $ = selector => document.querySelector(selector);
function paintScene(node, scene) {
  if (!scene) return;
  const color = scene.color >>> 0;
  node.style.backgroundColor = '#' + color.toString(16).padStart(6, '0').slice(-6);
  const luminance = [16,8,0].map(shift => ((color >> shift) & 255) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [.2126,.7152,.0722][i], 0);
  node.style.color = luminance > .179 ? '#000' : '#fff';
  node.querySelector('.monitor-scene-name').textContent = scene.name;
}
export function createMonitorRenderer() {
  const current = $('.monitor-current'), next = $('.monitor-next'), lines = $('.monitor-barlines');
  let timingKey = null, active = false, lock = null, pending = false;
  const wanted = () => active && !document.hidden;
  async function syncWakeLock() {
    if (!wanted()) { if (lock) { const old = lock; lock = null; old.release().catch(() => {}); } return; }
    if (lock || pending || !navigator.wakeLock) return;
    pending = true;
    try {
      const acquired = await navigator.wakeLock.request('screen');
      if (!wanted()) { await acquired.release(); return; }
      lock = acquired;
      acquired.addEventListener('release', () => { if (lock === acquired) lock = null; });
    } catch (_) { /* Secure context and browser permission are optional. */ }
    finally { pending = false; }
  }
  document.addEventListener('visibilitychange', syncWakeLock);
  return {
    setActive(value) { if (active !== value) { active = value; syncWakeLock(); } },
    render(input) {
      const view = monitorView(input);
      $('.monitor-song').textContent = view.song;
      $('.monitor-song').hidden = !view.song;
      $('.monitor-status').textContent = view.status || '';
      $('.monitor-status').hidden = !view.status;
      current.hidden = !view.current; next.hidden = !view.next;
      paintScene(current, view.current); paintScene(next, view.next);
      const key = view.current ? `${view.current.loopBeats}:${view.current.beatsPerBar}` : null;
      if (key !== timingKey) {
        timingKey = key; lines.replaceChildren();
        const bars = view.current && view.current.loopBeats / view.current.beatsPerBar;
        if (Number.isFinite(bars) && bars > 0) {
          const stride = Math.max(1, Math.ceil(bars / 2048));
          for (let k = stride; k < bars; k += stride) {
            const line = document.createElement('i');
            line.className = 'tile-barline' + (k % 4 === 0 ? ' bar-4' : '');
            line.style.left = (k / bars * 100) + '%'; lines.append(line);
          }
        }
      }
      lines.hidden = !view.progress;
      const fill = $('.monitor-fill'), counter = $('.monitor-counter');
      fill.hidden = counter.hidden = !view.progress;
      if (view.progress) {
        fill.style.width = view.progress.fraction * 100 + '%';
        counter.textContent = `${view.progress.bar} / ${Math.ceil(view.progress.bars)}`;
      }
    }
  };
}
