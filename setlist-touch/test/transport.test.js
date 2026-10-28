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
  const apis = [], tasks = [], out = [], writes = [], trace = [], logs = [];
  let now = 1000;
  function LiveAPI(cb) {
    this.id = 1; this.callback = typeof cb === 'function' ? cb : null; apis.push(this);
    this.get = prop => { trace.push(['get', prop]); if (prop === 'is_playing' && data.failPlayingRead) throw Error('read failed'); return [data[prop]]; };
    this.set = (prop, value) => { data[prop] = value; writes.push([prop, value]); changed(prop); };
    this.call = method => {
      trace.push(['call', method]);
      if (method === 'get_current_beats_song_time') { if (!data.beats_song_time) throw Error('unavailable'); return [data.beats_song_time]; }
      writes.push([method]);
      if (method === 'start_playing') data.is_playing = 1;
      if (method === 'stop_playing') data.is_playing = 0;
    };
    Object.defineProperty(this, 'property', {get:() => this.prop, set:prop => { this.prop = prop; if (prop && this.callback) this.callback([prop, data[prop]]); }});
  }
  function Task(fn, ctx) {
    this.fn = fn.bind(ctx); this.schedule = ms => { this.at = now + ms; }; this.cancel = () => this.at = null; tasks.push(this);
  }
  const changed = prop => { for (const api of apis) if (api.id && api.prop === prop) api.callback([prop, data[prop]]); };
  const ctx = vm.createContext({LiveAPI, Task, Date:{now:() => now}, outlet:(...args) => out.push(args), post:text => logs.push(text)});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../device/transport.js'), 'utf8'), ctx);
  const advance = ms => { now += ms; for (const task of tasks) if (task.at !== null && task.at <= now) { task.at = null; task.fn(); } };
  return {ctx, data, apis, tasks, out, writes, trace, logs, changed, advance};
}
test('Live lane observes all six properties, coalesces at 10 Hz and releases on refresh/deletion', () => {
  const h = harness(); a.equal(h.apis.length, 0); h.ctx.refresh(); h.advance(0);
  a.deepEqual(h.out, [[0, 'transport', 0, 0, 120, 0, 4, 4, '']]);
  a.equal(h.apis.filter(api => api.id && api.prop).length, 6);
  h.data.current_song_time = 2; h.changed('current_song_time'); h.advance(99); a.equal(h.out.length, 1);
  h.data.current_song_time = 3; h.changed('current_song_time'); h.data.tempo = 130; h.changed('tempo');
  h.advance(1); a.deepEqual(h.out[1], [0, 'transport', 0, 0, 130, 3, 4, 4, '']);
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

test('Live guard reads current state at each deferred command, including stale observations and failed reads', () => {
  const h = harness(); h.ctx.refresh(); h.advance(0); h.trace.length = 0;
  // Live changed without an observer notification; the published snapshot is stale.
  h.data.is_playing = 1; h.ctx.play(); a.deepEqual(h.writes, []);
  a.deepEqual(h.trace, [['get', 'is_playing']]); a.match(h.logs.at(-1), /play ignored/);
  h.trace.length = 0; h.ctx.stop();
  a.deepEqual(h.trace, [['get', 'is_playing'], ['call', 'stop_playing']]);
  h.trace.length = 0; h.ctx.stop(); a.deepEqual(h.trace, [['get', 'is_playing']]);
  a.match(h.logs.at(-1), /stop ignored/);
  h.data.failPlayingRead = true; h.ctx.play(); a.equal(h.writes.length, 1);
  a.match(h.logs.at(-1), /read failed/);
});
test('duplicate HTTP requests remain 204 but exercise Max guard without extra start/stop calls', async t => {
  const {EventEmitter} = require('events'), http = require('http');
  const {createApp} = require('../device/lib/app');
  const h = harness(); h.ctx.refresh(); h.advance(0); h.trace.length = 0;
  const bridge = new EventEmitter(); bridge.transport = (command, value) => h.ctx[command](value);
  const app = createApp({bridge, config:{username:'band', password:'pw', port:8765}});
  const port = await app.listen(0); t.after(() => app.close());
  for (const command of ['play', 'play', 'stop', 'stop']) {
    const status = await new Promise((resolve, reject) => {
      const req = http.request({hostname:'127.0.0.1', port, path:'/api/transport', method:'POST', headers:{'Content-Type':'application/json'}}, res => {
        res.resume(); res.on('end', () => resolve(res.statusCode));
      }); req.on('error', reject); req.end(JSON.stringify({command}));
    });
    a.equal(status, 204);
  }
  a.deepEqual(h.writes, [['start_playing'], ['stop_playing']]);
  a.equal(h.trace.filter(([op, prop]) => op === 'get' && prop === 'is_playing').length, 4);
  a.equal(h.logs.length, 2);
});
test('Live musical position overrides the single-signature calculation; call failure keeps fallback updates', () => {
  const h = harness(); h.data.signature_numerator = 3; h.data.beats_song_time = '37.2.3.004';
  h.ctx.refresh(); h.advance(0);
  const parse = message => parseTransport(Object.fromEntries(['is_playing', 'record_mode', 'tempo', 'current_song_time', 'signature_numerator', 'signature_denominator', 'beats_song_time'].map((key, i) => [key, message[i + 2]])));
  a.equal(h.out[0].at(-1), '37.2.3.004'); a.equal(parse(h.out[0]).position, '37.2');
  delete h.data.beats_song_time; h.data.current_song_time = 4; h.changed('current_song_time'); h.advance(100);
  a.equal(h.out[1].at(-1), ''); a.equal(parse(h.out[1]).position, '2.2');
  h.data.beats_song_time = 'invalid'; h.changed('current_song_time'); h.advance(100);
  a.equal(parse(h.out[2]).position, '2.2');
});
