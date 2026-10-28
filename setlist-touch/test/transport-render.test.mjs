import {test} from 'node:test';
import a from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createTransportRenderer} from '../device/web/js/transport-render.js';
import {initialState, reduce, canLaunch, prefsOf} from '../device/web/js/view-state.js';

function harness(t, create = true) {
  const keys = ['document', 'window', 'fetch', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const saved = Object.fromEntries(keys.map(k => [k, globalThis[k]]));
  t.after(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
  function target() {
    const listeners = new Map();
    return {addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
      emit(type, event = {}) { for (const fn of listeners.get(type) || []) fn(event); }};
  }
  function element(className) {
    const classes = new Set([className]), attrs = {}, styles = {};
    return {...target(), disabled:false, hidden:false, textContent:'', dataset:{}, style:{setProperty:(k, v) => styles[k] = v},
      classList:{contains:k => classes.has(k), toggle(k, on) { if (on) classes.add(k); else classes.delete(k); }},
      setAttribute:(k, v) => attrs[k] = v, closest:() => null, blur() {}};
  }
  const nodes = Object.fromEntries(['play', 'stop', 'rec', 'playing', 'tempo', 'position'].map(k => [k, element('transport-' + k)]));
  const buttons = [nodes.play, nodes.stop, nodes.rec];
  for (const button of buttons) button.closest = selector => selector === '.transport-bar button' ? button : null;
  const bar = {hidden:true, querySelectorAll:() => buttons, querySelector:s => nodes[s.replace('.transport-', '')]};
  const elements = new Map([['.transport-bar', bar]]), frames = new Map(), calls = [];
  let frameId = 0, hit = nodes.stop;
  const doc = {...target(), hidden:false, body:{dataset:{}},
    querySelector:s => { if (!elements.has(s)) elements.set(s, element(s)); return elements.get(s); },
    querySelectorAll:() => [], elementFromPoint:() => hit};
  globalThis.document = doc; globalThis.window = target();
  globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  globalThis.fetch = async (url, options) => { calls.push(JSON.parse(options.body)); return {ok:true}; };
  const h = {doc, nodes, buttons, bar, calls, state:{connected:true, locked:false},
    snapshot:{is_playing:1, record_mode:0, tempo:120, position:'1.1'},
    tick(time) { const pending = [...frames.values()]; frames.clear(); for (const fn of pending) fn(time); },
    pointer(type, id, time, button = nodes.stop) {
      hit = button;
      doc.emit(type, {pointerId:id, timeStamp:time, target:button, button:0, clientX:0, clientY:0, preventDefault() {}});
    }};
  if (create) h.ui = createTransportRenderer({enabled:true, stateOf:() => h.state, status() {}});
  return h;
}
test('transport UI gates Play/Stop by playback state and rechecks state when gestures complete', t => {
  const h = harness(t); const {ui, nodes, buttons, snapshot} = h;
  a.ok(buttons.every(b => b.disabled)); ui.accept(snapshot);
  a.equal(nodes.play.disabled, true); a.equal(nodes.stop.disabled, false); a.equal(nodes.rec.disabled, false);
  h.pointer('pointerdown', 1, 0, nodes.play); h.pointer('pointerup', 1, 100, nodes.play); a.equal(h.calls.length, 0);
  h.pointer('pointerdown', 2, 1000); h.tick(1999); a.equal(h.calls.length, 0);
  h.tick(2000); h.pointer('pointerup', 2, 2100); a.deepEqual(h.calls, [{command:'stop'}]);
  ui.accept({...snapshot, is_playing:0}); a.equal(nodes.play.disabled, false); a.equal(nodes.stop.disabled, true);
  h.pointer('pointerdown', 3, 3000); h.tick(4100); h.pointer('pointerup', 3, 4100); a.equal(h.calls.length, 1);
  h.pointer('pointerdown', 4, 5000, nodes.play); h.pointer('pointerup', 4, 5100, nodes.play);
  a.deepEqual(h.calls.at(-1), {command:'play'});
  ui.accept(snapshot); h.pointer('pointerdown', 5, 6000); ui.accept({...snapshot, is_playing:0});
  h.tick(7100); h.pointer('pointerup', 5, 7100); a.equal(h.calls.length, 2);
});
test('transport UI resets fresh-state readiness on reconnect and retains the Rec target during a hold', t => {
  const h = harness(t); const {ui, snapshot, nodes, buttons} = h; ui.accept(snapshot);
  h.pointer('pointerdown', 1, 0); ui.reset(); h.tick(1100); // No pointerup arrives.
  a.equal(h.calls.length, 0); a.ok(buttons.every(b => b.disabled));
  ui.syncAvailability(); a.ok(buttons.every(b => b.disabled));
  ui.accept(snapshot); h.pointer('pointerdown', 2, 2000, nodes.rec);
  ui.accept({...snapshot, record_mode:1}); h.tick(3000); h.pointer('pointerup', 2, 3100, nodes.rec);
  a.deepEqual(h.calls, [{command:'record', value:1}]);
  h.pointer('pointerdown', 3, 4000); h.state.connected = false; ui.syncAvailability(); h.tick(5100);
  a.equal(h.calls.length, 1); a.ok(buttons.every(b => b.disabled));
  h.state = {connected:true, locked:true}; ui.accept(snapshot); a.ok(buttons.every(b => b.disabled));
});
for (const reason of ['blur', 'hidden', 'pointercancel']) {
  test(`${reason} clears abandoned hold and tap pointers; subsequent transport works without reload`, t => {
    const h = harness(t); const {ui, snapshot, nodes} = h; ui.accept(snapshot);
    // Include multiple abandoned pointers to exercise both gesture detectors' blocked state.
    h.pointer('pointerdown', 1, 0); h.pointer('pointerdown', 2, 50, nodes.play);
    const clear = () => {
      if (reason === 'blur') window.emit('blur');
      if (reason === 'hidden') { h.doc.hidden = true; h.doc.emit('visibilitychange'); }
      if (reason === 'pointercancel') h.doc.emit('pointercancel', {pointerId:2});
    };
    clear(); h.tick(1100); a.equal(h.calls.length, 0); h.doc.hidden = false;
    // A real active hold is also cancelled without delivering its pointerup.
    h.pointer('pointerdown', 3, 2000); h.tick(2400); clear(); h.tick(3100);
    a.equal(h.calls.length, 0); h.doc.hidden = false;
    h.pointer('pointerdown', 4, 4000); h.tick(5000); h.pointer('pointerup', 4, 5100);
    a.deepEqual(h.calls, [{command:'stop'}]);
    ui.accept({...snapshot, is_playing:0});
    h.pointer('pointerdown', 5, 6000, nodes.play); h.pointer('pointerup', 5, 6100, nodes.play);
    a.deepEqual(h.calls.at(-1), {command:'play'});
  });
}
test('empty-set app enables transport from its connection and own snapshot, independently of scene readiness', t => {
  const h = harness(t, false); let events;
  function EventSource() { events = Object.assign(this, {addEventListener:target.addEventListener, emit:target.emit}); }
  const target = (() => {
    const listeners = new Map();
    return {addEventListener(type, fn) { listeners.set(type, fn); }, emit(type, value) { listeners.get(type)({data:JSON.stringify(value)}); }};
  })();
  const app = fs.readFileSync(new URL('../device/web/js/app.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
  vm.runInNewContext(app, {
    document, window, location:{hostname:'localhost', search:'?transport=1', hash:''},
    localStorage:{getItem:() => null, setItem() {}}, URLSearchParams, EventSource,
    ResizeObserver:class { observe() {} }, setTimeout, clearTimeout, fetch:globalThis.fetch,
    createTransportRenderer, createTapDetector:() => ({down() {}, move() {}, up() { return null; }, cancel() {}}),
    createMixRenderer:() => ({render() {}, cancel() {}, syncAvailability() {}, updateLevels() {}}),
    initialMixState:() => ({page:'scenes'}), reduceMix:s => s,
    initialState, reduce, canLaunch, prefsOf, render() {}, updatePlayback() {}, fitSceneRows() {}
  });
  a.ok(h.buttons.every(b => b.disabled)); events.emit('open');
  events.emit('set', {songs:[], categories:[], sceneToSong:{}}); events.emit('play', {playing:-1, fired:-1});
  a.ok(h.buttons.every(b => b.disabled)); // A connection alone cannot replace the transport snapshot.
  events.emit('transport', {...h.snapshot, is_playing:0});
  a.equal(h.nodes.play.disabled, false); a.equal(h.nodes.stop.disabled, true); a.equal(h.nodes.rec.disabled, false);
  h.pointer('pointerdown', 1, 0, h.nodes.play); h.pointer('pointerup', 1, 100, h.nodes.play);
  a.deepEqual(h.calls, [{command:'play'}]);
  events.emit('set', {songs:[], categories:[], sceneToSong:{}});
  a.equal(h.nodes.play.disabled, false); // Scene reloads must not remove transport availability.
  document.querySelector('.lock-toggle').emit('click'); a.ok(h.buttons.every(b => b.disabled));
  document.querySelector('.lock-toggle').emit('click'); a.equal(h.nodes.play.disabled, false);
  events.emit('error'); a.ok(h.buttons.every(b => b.disabled));
  events.emit('open'); a.ok(h.buttons.every(b => b.disabled));
  events.emit('transport', h.snapshot); a.equal(h.nodes.stop.disabled, false);
});
