const {test} = require('node:test');
const a = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const {formatPosition, validCommand, parseTransport} = require('../device/lib/transport');
test('position is one-based and uses signature denominator beat units', () => {
  a.equal(formatPosition(0), '1.1'); a.equal(formatPosition(3.999), '1.4');
  a.equal(formatPosition(4), '2.1'); a.equal(formatPosition(42), '11.3');
  a.equal(formatPosition(0, 6, 8), '1.1'); a.equal(formatPosition(2.5, 6, 8), '1.6');
  a.equal(formatPosition(3, 6, 8), '2.1'); a.equal(formatPosition(3.5, 6, 8), '2.2');
  a.equal(formatPosition(5, 3, 4), '2.3'); a.equal(formatPosition(NaN), null);
  a.equal(formatPosition(1, 0, 4), null);
});
test('command validation requires explicit numeric recording target', () => {
  for (const value of [{command:'play'}, {command:'stop'}, {command:'record', value:0}, {command:'record', value:1}]) a.equal(validCommand(value), true);
  for (const value of [null, [], 'play', {}, {command:'toggle'}, {command:'record'}, {command:'record', value:true}, {command:'record', value:'1'}, {command:'record', value:2}, {command:'stop', value:1}, {command:'play', extra:1}]) a.equal(validCommand(value), false);
  a.equal(parseTransport({}), null);
});
function harness() {
  const data = {is_playing:0, record_mode:0, tempo:120, current_song_time:0, signature_numerator:4, signature_denominator:4};
  const apis = [], tasks = [], out = [], writes = [];
  let now = 1000;
  function LiveAPI(cb) {
    this.id = 1; this.callback = typeof cb === 'function' ? cb : null; apis.push(this);
    this.get = prop => [data[prop]];
    this.set = (prop, value) => { data[prop] = value; writes.push([prop, value]); changed(prop); };
    this.call = method => writes.push([method]);
    Object.defineProperty(this, 'property', {get:() => this.prop, set:prop => { this.prop = prop; if (prop && this.callback) this.callback([prop, data[prop]]); }});
  }
  function Task(fn, ctx) {
    this.fn = fn.bind(ctx); this.schedule = ms => { this.at = now + ms; }; this.cancel = () => this.at = null; tasks.push(this);
  }
  const changed = prop => { for (const api of apis) if (api.id && api.prop === prop) api.callback([prop, data[prop]]); };
  const ctx = vm.createContext({LiveAPI, Task, Date:{now:() => now}, outlet:(...args) => out.push(args)});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../device/transport.js'), 'utf8'), ctx);
  const advance = ms => { now += ms; for (const task of tasks) if (task.at !== null && task.at <= now) { task.at = null; task.fn(); } };
  return {ctx, data, apis, tasks, out, writes, changed, advance};
}
test('Live lane observes all six properties, coalesces at 10 Hz and releases on refresh/deletion', () => {
  const h = harness(); a.equal(h.apis.length, 0); h.ctx.refresh(); h.advance(0);
  a.deepEqual(h.out, [[0, 'transport', 0, 0, 120, 0, 4, 4]]);
  a.equal(h.apis.filter(api => api.id && api.prop).length, 6);
  h.data.current_song_time = 2; h.changed('current_song_time'); h.advance(99); a.equal(h.out.length, 1);
  h.data.current_song_time = 3; h.changed('current_song_time'); h.data.tempo = 130; h.changed('tempo');
  h.advance(1); a.deepEqual(h.out[1], [0, 'transport', 0, 0, 130, 3, 4, 4]);
  h.ctx.refresh(); a.equal(h.apis.filter(api => api.id && api.prop).length, 6);
  h.ctx.notifydeleted(); a.equal(h.apis.filter(api => api.id).length, 0); a.ok(h.tasks.every(t => t.at === null));
});
test('deferred Live commands call transport and set recording target rather than toggling', () => {
  const h = harness(); h.ctx.play(); a.equal(h.writes.length, 0); h.ctx.refresh();
  h.ctx.play(); h.ctx.stop(); h.ctx.record(1); h.ctx.record(1); h.ctx.record(0);
  h.ctx.record('1'); h.ctx.record(2); h.ctx.record();
  a.deepEqual(h.writes, [['start_playing'], ['stop_playing'], ['record_mode', 1], ['record_mode', 1], ['record_mode', 0]]);
  h.ctx.notifydeleted(); h.ctx.stop(); a.equal(h.writes.length, 5);
});
test('fake transport echoes state and recording commands are idempotent', () => {
  const {createFakeBridge} = require('../device/lib/fake-bridge');
  const bridge = createFakeBridge([]); let state; bridge.on('transport', value => state = value);
  bridge.snapshot(); a.equal(state.current_song_time, 0);
  bridge.transport('play'); a.equal(state.is_playing, 1);
  bridge.transport('record', 1); bridge.transport('record', 1); a.equal(state.record_mode, 1);
  bridge.transport('stop'); a.equal(state.is_playing, 0); a.equal(state.record_mode, 1);
  bridge.transport('record', 0); a.equal(state.record_mode, 0);
});
