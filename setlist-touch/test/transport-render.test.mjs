import {test} from 'node:test';
import a from 'node:assert/strict';
import {createTransportRenderer} from '../device/web/js/transport-render.js';

test('transport UI requires fresh snapshots, cancels lost connections, and retains intended recording target', async () => {
  const saved = Object.fromEntries(['document', 'fetch', 'requestAnimationFrame', 'cancelAnimationFrame'].map(k => [k, globalThis[k]]));
  const listeners = {}, frames = new Map(), calls = [];
  let frameId = 0;
  function element(className) {
    const classes = new Set([className]), attrs = {};
    return {disabled:false, hidden:false, textContent:'', style:{setProperty() {}},
      classList:{contains:k => classes.has(k), toggle(k, on) { if (on) classes.add(k); else classes.delete(k); }},
      setAttribute:(k, v) => attrs[k] = v, closest:() => null, addEventListener() {}};
  }
  const nodes = Object.fromEntries(['play', 'stop', 'rec', 'playing', 'tempo', 'position'].map(k => [k, element('transport-' + k)]));
  const buttons = [nodes.play, nodes.stop, nodes.rec];
  for (const button of buttons) button.closest = () => button;
  const bar = {hidden:true, querySelectorAll:() => buttons, querySelector:s => nodes[s.replace('.transport-', '')]};
  let hit = nodes.stop;
  globalThis.document = {querySelector:() => bar, elementFromPoint:() => hit,
    addEventListener:(type, fn) => listeners[type] = fn};
  globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  globalThis.fetch = async (url, options) => { calls.push(JSON.parse(options.body)); return {ok:true}; };
  const tick = t => { const pending = [...frames]; frames.clear(); for (const [, fn] of pending) fn(t); };
  const pointer = (type, id, t, target = nodes.stop) => listeners[type]({pointerId:id, timeStamp:t,
    target, button:0, clientX:0, clientY:0, preventDefault() {}});
  const snapshot = {is_playing:1, record_mode:0, tempo:120, position:'1.1'};
  let state = {connected:true, locked:false};
  try {
    const disabled = createTransportRenderer({enabled:false, stateOf:() => state, status() {}});
    disabled.accept(snapshot); a.equal(bar.hidden, true); a.deepEqual(listeners, {});
    const ui = createTransportRenderer({enabled:true, stateOf:() => state, status() {}});
    a.ok(buttons.every(b => b.disabled)); ui.accept(snapshot); a.ok(buttons.every(b => !b.disabled));
    pointer('pointerdown', 1, 0); tick(999); a.equal(calls.length, 0);
    tick(1000); a.deepEqual(calls, [{command:'stop'}]); pointer('pointerup', 1, 1100); a.equal(calls.length, 1);
    pointer('pointerdown', 2, 2000); ui.reset(); tick(3100); pointer('pointerup', 2, 3100);
    a.equal(calls.length, 1); a.ok(buttons.every(b => b.disabled));
    ui.syncAvailability(); a.ok(buttons.every(b => b.disabled)); // HTTP/SSE recovery alone is insufficient.
    ui.accept(snapshot); a.ok(buttons.every(b => !b.disabled));
    hit = nodes.rec; pointer('pointerdown', 3, 4000, nodes.rec);
    ui.accept({...snapshot, record_mode:1}); tick(5000); pointer('pointerup', 3, 5100, nodes.rec);
    a.deepEqual(calls.at(-1), {command:'record', value:1}); // Another screen changed it mid-hold.
    hit = nodes.stop; pointer('pointerdown', 4, 6000);
    state = {...state, connected:false}; ui.syncAvailability(); tick(7100); pointer('pointerup', 4, 7100);
    a.equal(calls.length, 2); a.ok(buttons.every(b => b.disabled));
    state = {connected:true, locked:true}; ui.accept(snapshot); a.ok(buttons.every(b => b.disabled));
    state = {...state, locked:false}; ui.syncAvailability(); a.ok(buttons.every(b => !b.disabled));
    await Promise.resolve();
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
