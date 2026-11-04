const {test} = require('node:test');
const a = require('node:assert/strict');
const {EventEmitter} = require('events');
const fs = require('fs'), path = require('path'), vm = require('vm');
const {copyText} = require('../device/lib/clipboard');
const device = path.join(__dirname, '../device');
const flush = () => new Promise(resolve => setImmediate(resolve));
for (const [platform, command] of [['win32','clip.exe'],['darwin','pbcopy']]) {
 test('clipboard uses stdin without a shell on ' + platform, async () => {
  const child = new EventEmitter(); child.stdin = new EventEmitter(); let input;
  child.stdin.end = (text, encoding) => { input = [text,encoding]; };
  const text = 'http://192.168.1.2:8766';
  const pending = copyText(text, {platform, spawnProcess:(cmd,args,options) => {
   a.equal(cmd,command); a.deepEqual(args,[]); a.equal(options.shell,false);
   a.deepEqual(options.stdio,['pipe','ignore','ignore']); return child;
  }});
  a.deepEqual(input,[text,'utf8']); child.emit('close',0); await pending;
 });
}
test('clipboard rejects spawn, stdin, exit, signal and unsupported platform failures', async () => {
 for (const mode of ['throw','spawn','stdin','exit','signal']) {
  const child = new EventEmitter(); child.stdin = new EventEmitter(); child.stdin.end = () => {};
  const pending = copyText('http://127.0.0.1:8765', {platform:'win32', spawnProcess:() => {
   if (mode === 'throw') throw Error('missing clip'); return child;
  }});
  if (mode === 'spawn') child.emit('error',Error('missing clip'));
  if (mode === 'stdin') child.stdin.emit('error',Error('broken pipe'));
  if (mode === 'exit') child.emit('close',1);
  if (mode === 'signal') child.emit('close',null,'SIGTERM');
  await a.rejects(pending);
  if (mode !== 'throw') {child.emit('error',Error('late')); child.emit('close',1);}
 }
 await a.rejects(copyText('url',{platform:'linux',spawnProcess:() => a.fail('must not spawn')}), /unavailable/);
});
test('address output reaches Node only through a bare trigger and copy command', () => {
 const p = JSON.parse(fs.readFileSync(path.join(device,'SetlistTouch.maxpat'))).patcher;
 const boxes = Object.fromEntries(p.boxes.map(({box}) => [box.id,box]));
 const destinations = id => p.lines.filter(({patchline:l}) => l.source[0] === id).map(({patchline:l}) => l.destination);
 a.deepEqual(destinations('address'),[['copy-trigger',0]]); a.equal(boxes['copy-trigger'].text,'t b');
 a.deepEqual(destinations('copy-trigger'),[['copy-command',0]]); a.equal(boxes['copy-command'].text,'copyAddress');
 a.deepEqual(destinations('copy-command'),[['node',0]]);
});
function server({copy = async () => {}, failed = false} = {}) {
 const outlets = [], posts = [], handlers = {}, timers = new Map(); let nextTimer = 0, bridge, start, fail;
 const max = {outlet:(...args) => outlets.push(args),post:text => posts.push(text),addHandler:(name,fn) => handlers[name] = fn};
 const req = name => name === 'max-api' ? max : name === './lib/clipboard' ? {copyText:copy} :
  name === 'os' ? {networkInterfaces:() => ({lan:[{family:'IPv4',address:'192.168.1.2',internal:false}]})} :
  name === './lib/app' ? {createApp:options => {
   bridge = options.bridge;
   return {listenWithFallback:() => new Promise((resolve,reject) => {start = resolve; fail = reject;}),getPortNote:() => 'Port 8765 was busy — now on 8766',getConfig:() => ({port:8765})};
  }} : name === './lib/config' ? {loadConfig:() => ({})} : require(name);
 vm.runInNewContext(fs.readFileSync(path.join(device,'setlist-server.js'),'utf8'), {
  require:req,process:{on:() => {}},
  setTimeout:(fn,ms) => {const id = ++nextTimer; timers.set(id,{fn,ms}); return id;},clearTimeout:id => timers.delete(id)
 });
 return {outlets,posts,handlers,bridge,timers,start:() => failed ? fail(Error('Startup failed')) : start(8766),
  expire:() => {a.equal(timers.size,1);const [id,{fn,ms}] = timers.entries().next().value; a.equal(ms,2000);timers.delete(id);fn();}};
}
test('no copy before listening or after startup failure', async () => {
 for (const failed of [false,true]) {
  let calls = 0; const s = server({failed,copy:async () => calls++});
  await s.handlers.copyAddress(); a.equal(calls,0); a.deepEqual(s.outlets,[]); s.start(); await flush();
  if (failed) {const before = s.outlets.slice();await s.handlers.copyAddress(); a.equal(calls,0);a.deepEqual(s.outlets,before);}
 }
});
test('URL only is copied, confirmation lasts two seconds and restores the port note', async () => {
 const copied = []; const s = server({copy:async text => copied.push(text)}); s.start(); await flush();
 const normal = s.outlets.find(o => o[0] === 'address'); await s.handlers.copyAddress();
 a.deepEqual(copied,['http://192.168.1.2:8766']); a.deepEqual(s.outlets.at(-1),['address','Copied: ' + copied[0]]);
 s.expire(); a.deepEqual(s.outlets.at(-1),normal);
});
test('feedback restores latest indexing state or completion with a changed port', async () => {
 const s = server(); s.start(); await flush(); await s.handlers.copyAddress(); const feedback = s.outlets.at(-1);
 s.handlers.progress(2,100); await flush(); a.deepEqual(s.outlets.at(-1),feedback);
 s.expire(); a.deepEqual(s.outlets.at(-1),['progress',2,100]); await s.handlers.copyAddress();
 s.bridge.addressChanged(9000); s.handlers.progress(100,100); await flush(); s.expire();
 a.match(s.outlets.at(-1)[1],/Port 8765 was busy.*\nhttp:\/\/192.168.1.2:9000$/);
});
test('copy failure shows URL, logs error and restores current progress', async () => {
 const s = server({copy:async () => {throw Error('missing clip');}}); s.start(); await flush(); await s.handlers.copyAddress();
 a.deepEqual(s.outlets.at(-1),['address',"Couldn't copy — address: http://192.168.1.2:8766"]); a.match(s.posts[0],/missing clip/);
 s.handlers.progress(3,10); await flush(); s.expire(); a.deepEqual(s.outlets.at(-1),['progress',3,10]);
});
test('repeated clicks reset feedback; stale results cannot overwrite a newer address', async () => {
 const pending = []; const s = server({copy:() => new Promise(resolve => pending.push(resolve))}); s.start(); await flush();
 const first = s.handlers.copyAddress(), second = s.handlers.copyAddress(); pending[1](); await second;
 const feedback = s.outlets.at(-1); pending[0](); await first; a.deepEqual(s.outlets.at(-1),feedback); a.equal(s.timers.size,1);
 const third = s.handlers.copyAddress(); a.equal(s.timers.size,0); s.bridge.addressChanged(9000); pending[2](); await third;
 a.match(s.outlets.filter(o => o[0] === 'address').at(-1)[1],/:9000$/); a.equal(s.timers.size,0);
});
