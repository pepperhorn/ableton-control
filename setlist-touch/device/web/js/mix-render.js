import {createFaderGesture} from './fader.js';
import {faderValue, valueLabel} from './mix-view.js';
import {canLaunch} from './view-state.js';
const $ = selector => document.querySelector(selector);
function el(tag, className, text) {
  const node = document.createElement(tag); node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function createMixRenderer({stateOf, mixOf, viewOf, onTab, onSnapshot, status}) {
  const pointers = new Set(), channels = new Map();
  let gesture = null, dragging = null;
  function selectedReturn() { return mixOf().returns.find(r => r.name === viewOf().tab); }
  function usable() { return viewOf().page === 'mix' && location.hash !== '#settings' && canLaunch(stateOf()); }
  function currentLevel(row) {
    const strip = mixOf().strips.find(s => s.trackIndex === Number(row.dataset.trackIndex));
    return strip && strip.levels[Number(row.dataset.returnIndex)];
  }
  function paint(row, level) {
    if (!level) return;
    row.querySelector('.mix-fill').style.width = `${level.value * 100}%`;
    row.querySelector('.mix-value').textContent = valueLabel(level);
    row.setAttribute('aria-valuenow', String(Math.round(level.value * 100)));
    row.setAttribute('aria-valuetext', valueLabel(level));
  }
  function updateLevels() {
    for (const row of document.querySelectorAll('.mix-row'))
      paint(row, faderValue(currentLevel(row), dragging && dragging.row === row ? dragging.level : null));
  }
  function cancel() {
    if (gesture) for (const id of pointers) gesture.cancel(id);
    gesture = null; dragging = null;
    for (const entry of channels.values()) { clearTimeout(entry.timer); entry.pending = null; }
    updateLevels();
    for (const row of document.querySelectorAll('.mix-row')) row.classList.remove('is-dragging');
  }
  async function flush(entry) {
    clearTimeout(entry.timer); entry.timer = null;
    if (entry.inFlight || !entry.pending || !usable()) return;
    const remaining = 33 - (performance.now() - entry.last);
    if (!entry.final && remaining > 0) { entry.timer = setTimeout(() => flush(entry), Math.ceil(remaining)); return; }
    const command = entry.pending; entry.pending = null; entry.inFlight = true; entry.last = performance.now();
    try {
      const res = await fetch('/api/send', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(command)});
      if (res.status === 409) {
        cancel();
        const data = await res.json(); onSnapshot(data.mix);
        const row = document.querySelector(`.mix-row[data-track-index="${command.trackIndex}"]`);
        if (row) { row.classList.add('is-stale'); setTimeout(() => row.classList.remove('is-stale'), 1000); }
        status('Mix changed. Check the row and slide again.');
      } else if (!res.ok) { cancel(); status('Could not change mix. Check the connection.'); }
    } catch (_) { cancel(); status('Could not change mix. Check the connection.'); }
    finally {
      entry.inFlight = false;
      if (entry.pending && usable()) {
        const delay = entry.final ? 0 : Math.max(0, 33 - (performance.now() - entry.last));
        entry.timer = setTimeout(() => flush(entry), delay);
      }
    }
  }
  function send(row, value, final = false) {
    if (!usable() || !row.isConnected) return;
    const trackIndex = Number(row.dataset.trackIndex), returnIndex = Number(row.dataset.returnIndex);
    const key = `${trackIndex}:${returnIndex}`;
    let entry = channels.get(key);
    if (!entry) { entry = {last:-Infinity, timer:null, inFlight:false}; channels.set(key, entry); }
    entry.pending = {trackIndex, returnIndex, rawName:row.dataset.rawName, returnName:row.dataset.returnName, value};
    entry.final = final;
    const delay = final ? 0 : Math.max(0, 33 - (performance.now() - entry.last));
    if (!entry.inFlight) {
      clearTimeout(entry.timer);
      if (delay === 0) flush(entry); else entry.timer = setTimeout(() => flush(entry), delay);
    }
  }
  function render() {
    cancel();
    const ret = selectedReturn(), mix = mixOf(), tabs = $('.send-tabs'), list = $('.mix-list');
    tabs.replaceChildren(); list.replaceChildren();
    for (const r of mix.returns) {
      const tab = el('button','send-tab' + (r === ret ? ' is-active' : ''),r.name);
      tab.type = 'button'; tab.setAttribute('aria-pressed',String(r === ret));
      tab.addEventListener('click', () => onTab(r.name)); tabs.append(tab);
    }
    if (!ret || !mix.strips.length) list.append(el('p','mix-empty',!ret ? 'Waiting for player returns from Live…' : 'Tag tracks with + and a space to add them to the mix.'));
    for (const strip of ret ? mix.strips : []) {
      const level = strip.levels[ret.returnIndex]; if (!level) continue;
      const row = el('div','mix-row');
      row.dataset.trackIndex = strip.trackIndex; row.dataset.returnIndex = ret.returnIndex;
      row.dataset.rawName = strip.rawName; row.dataset.returnName = ret.name;
      row.setAttribute('role','slider'); row.setAttribute('aria-label',`${strip.name} to ${ret.name}`);
      row.setAttribute('aria-valuemin','0'); row.setAttribute('aria-valuemax','100');
      row.setAttribute('aria-orientation','horizontal');
      const fill = el('span','mix-fill'); fill.setAttribute('aria-hidden','true');
      fill.style.backgroundColor = '#' + (strip.color >>> 0).toString(16).padStart(6,'0').slice(-6);
      row.append(fill,el('span','mix-label',strip.name),el('span','mix-value'));
      paint(row,level); list.append(row);
    }
    syncAvailability();
  }
  function syncAvailability() {
    for (const row of document.querySelectorAll('.mix-row')) row.setAttribute('aria-disabled',String(!usable()));
    if (!usable()) cancel();
  }
  document.addEventListener('pointerdown', e => {
    pointers.add(e.pointerId);
    if (pointers.size > 1) { cancel(); return; }
    const row = e.target.closest('.mix-row');
    if (!row || !usable() || e.button !== 0) return;
    const level = currentLevel(row); if (!level) return;
    gesture = createFaderGesture({fullScalePx:row.clientWidth});
    gesture.down(e.pointerId,e.clientX,e.clientY,level.value);
    dragging = {id:e.pointerId,row,level};
  });
  document.addEventListener('pointermove', e => {
    if (!gesture || !dragging || !usable()) return;
    const value = gesture.move(e.pointerId,e.clientX,e.clientY);
    if (value === null) return;
    // pan-y lets native vertical scrolling cancel this pointer. Capture only
    // after a horizontal classification; a tap never touches the send lane.
    if (e.pointerId === dragging.id) {
      try { dragging.row.setPointerCapture(e.pointerId); } catch (_) {}
      dragging.level = {value,label:''}; dragging.row.classList.add('is-dragging');
      paint(dragging.row,dragging.level); send(dragging.row,value);
    }
  });
  document.addEventListener('pointerup', e => {
    pointers.delete(e.pointerId);
    if (!gesture || !dragging) return;
    const value = gesture.up(e.pointerId), row = dragging.row;
    if (e.pointerId !== dragging.id) return;
    if (value !== null && usable()) send(row,value,true);
    row.classList.remove('is-dragging'); gesture = null; dragging = null; updateLevels();
  });
  document.addEventListener('pointercancel',e => { pointers.delete(e.pointerId); cancel(); });
  $('.mix-list').addEventListener('scroll',cancel,{passive:true});
  window.addEventListener('blur',() => { cancel(); pointers.clear(); });
  document.addEventListener('visibilitychange',() => { cancel(); pointers.clear(); });
  return {render, updateLevels, cancel, syncAvailability};
}
