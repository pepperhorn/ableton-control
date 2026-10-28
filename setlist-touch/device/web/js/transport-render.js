import {createHoldGesture} from './hold.js';
import {createTapDetector} from './tap.js';
import {canLaunch} from './view-state.js';
export function createTransportRenderer({enabled, stateOf, status}) {
  const bar = document.querySelector('.transport-bar');
  bar.hidden = !enabled;
  if (!enabled) return {syncAvailability() {}, accept() {}, reset() {}, cancel() {}};
  const buttons = [...bar.querySelectorAll('button')];
  const hold = createHoldGesture(), tap = createTapDetector(), pointers = new Set();
  let snapshot = null, held = null, frame = null;
  const available = () => !!snapshot && canLaunch(stateOf()) && !bar.hidden;
  const permitted = command => available() && (command === 'play' ? !snapshot.is_playing : command === 'stop' ? !!snapshot.is_playing : true);
  const hitButton = e => {
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    return hit && hit.closest('.transport-bar button');
  };
  function cancel() {
    if (held) hold.move(held.id, false);
    held = null; cancelAnimationFrame(frame); frame = null;
    for (const button of buttons) button.style.setProperty('--hold-progress', '0');
    for (const id of pointers) tap.move(id, Infinity, Infinity);
  }
  function clearPointers() {
    cancel();
    for (const id of pointers) tap.cancel(id);
    pointers.clear(); hold.reset();
  }
  async function send(command, value) {
    if (!permitted(command)) return;
    try {
      const res = await fetch('/api/transport', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({command, ...(command === 'record' ? {value} : {})})});
      if (!res.ok) status('Could not change transport. Check the connection.');
    } catch (_) { reset(); status('Could not change transport. Reconnecting…'); }
  }
  function complete(t) {
    if (!held) return;
    const action = held;
    if (hold.up(action.id, t)) { cancel(); send(action.command, action.value); }
  }
  function animate(t) {
    if (!held || !permitted(held.command)) { cancel(); return; }
    const progress = hold.progress(t);
    held.button.style.setProperty('--hold-progress', String(progress));
    if (progress >= 1) complete(t);
    else frame = requestAnimationFrame(animate);
  }
  function syncAvailability() {
    for (const button of buttons) button.disabled = !permitted(button.classList.contains('transport-play') ? 'play' : button.classList.contains('transport-stop') ? 'stop' : 'record');
    if (!available() || (held && !permitted(held.command))) cancel();
  }
  function accept(next) {
    snapshot = next;
    bar.querySelector('.transport-playing').textContent = next.is_playing ? 'Playing' : 'Stopped';
    bar.querySelector('.transport-playing').classList.toggle('is-playing', !!next.is_playing);
    const rec = bar.querySelector('.transport-rec');
    rec.classList.toggle('is-recording', !!next.record_mode);
    rec.setAttribute('aria-pressed', String(!!next.record_mode));
    rec.setAttribute('aria-label', `${next.record_mode ? 'Disable' : 'Enable'} Arrangement Record (hold 1 second)`);
    bar.querySelector('.transport-tempo').textContent = next.tempo.toFixed(2);
    bar.querySelector('.transport-position').textContent = next.position;
    syncAvailability();
  }
  function reset() { snapshot = null; clearPointers(); syncAvailability(); }
  // Observe every pointer, including second fingers outside the transport row.
  document.addEventListener('pointerdown', e => {
    pointers.add(e.pointerId);
    hold.down(e.pointerId, e.timeStamp);
    const button = e.target.closest('.transport-bar button');
    tap.down(e.pointerId, e.clientX, e.clientY, e.timeStamp,
      e.button === 0 && available() && button && !button.disabled && button.classList.contains('transport-play') ? button : null);
    if (pointers.size > 1) { cancel(); return; }
    if (!button || button.disabled || e.button !== 0 || !available() || button.classList.contains('transport-play')) return;
    held = {id:e.pointerId, button, command:button.classList.contains('transport-rec') ? 'record' : 'stop', value:snapshot.record_mode ? 0 : 1};
    e.preventDefault(); frame = requestAnimationFrame(animate);
  });
  document.addEventListener('pointermove', e => {
    tap.move(e.pointerId, e.clientX, e.clientY);
    if (held && held.id === e.pointerId && hitButton(e) !== held.button) { hold.move(e.pointerId, false); cancel(); }
  });
  document.addEventListener('pointerup', e => {
    const button = hitButton(e);
    const play = tap.up(e.pointerId, e.clientX, e.clientY, e.timeStamp, button);
    if (held && held.id === e.pointerId) {
      if (button !== held.button) hold.move(e.pointerId, false);
      complete(e.timeStamp); cancel();
    }
    hold.up(e.pointerId, e.timeStamp); pointers.delete(e.pointerId);
    if (play) { play.blur(); send('play'); }
  });
  document.addEventListener('pointercancel', clearPointers);
  window.addEventListener('blur', clearPointers);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearPointers(); });
  // Native clicks (including Enter and Space) never operate transport.
  for (const button of buttons) button.addEventListener('click', e => e.preventDefault());
  syncAvailability();
  return {accept, reset, cancel, syncAvailability};
}
