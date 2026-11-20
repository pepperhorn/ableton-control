'use strict';
const {test} = require('node:test');
const a = require('node:assert/strict');
const {EventEmitter} = require('events');
const {encode, decode} = require('../device/lib/osc');
const {createX32, levelToDb, defaultLabel} = require('../device/lib/x32');
const {createFakeX32} = require('../device/lib/fake-x32');
function harness(options = {}) {
  let time = 0, next = 0, online = true;
  const timers = new Map(), sent = [], socket = new EventEmitter();
  const desk = createFakeX32({linked:[5], sources:[{id:'ch/03',name:'Vocal',color:3}]});
  socket.setBroadcast = () => {};
  const reply = (buf, host = '192.168.1.32', port = 10023) => socket.emit('message', buf, {address:host,port});
  socket.send = (buf, port, host) => { sent.push({host,port,...decode(buf)}); if (online) desk.handle(buf, reply); };
  const client = createX32({socket, now:() => time, setTimer:(fn, ms) => {const id = ++next; timers.set(id, {fn,at:time+ms}); return id;}, clearTimer:id => timers.delete(id), ...options});
  const advance = ms => { const end = time+ms; while (true) {const entry = [...timers].sort((a,b) => a[1].at-b[1].at)[0]; if (!entry || entry[1].at > end) break; time = entry[1].at; timers.delete(entry[0]); entry[1].fn();} time = end; };
  return {client,desk,sent,reply,advance,timers, socket, offline:() => {online=false;}};
}
test('levelToDb maps 0.75 → "0.0 dB", 0.5 → "-10.0 dB", 0 → "-inf dB"', () => {
  a.equal(levelToDb(0.75), '0.0 dB'); a.equal(levelToDb(0.5), '-10.0 dB'); a.equal(levelToDb(0), '-inf dB');
  a.equal(levelToDb(0.25), '-30.0 dB'); a.equal(levelToDb(0.0625), '-60.0 dB');
});
test('discovers desk by /xinfo and goes connected; loads snapshot then emits snapshot', () => {
  const h = harness(); let snapshots = 0; h.client.on('snapshot', () => snapshots++);
  a.equal(h.client.snapshot(), null); h.client.start(); h.advance(3000);
  a.equal(h.sent[0].address, '/xinfo'); a.equal(h.sent[0].host, '255.255.255.255');
  a.equal(h.client.status().state, 'connected'); a.equal(snapshots, 1);
  a.equal(h.client.snapshot().sources.length, 48); a.equal(h.client.snapshot().buses.length, 15);
  a.deepEqual(h.desk.writes, []); h.client.stop();
});
test('manual host wins over discovery', () => {
  const h = harness({host:'192.168.1.99'}); h.client.start();
  h.reply(encode('/xinfo', ['192.168.1.32','Other','X32','4.0']));
  h.advance(3000); a.notEqual(h.client.status().state, 'connected');
  a.ok(h.sent.every(p => p.host === '192.168.1.99'));
  h.reply(encode('/xinfo', ['192.168.1.99','Manual','X32','4.0']), '192.168.1.99');
  a.equal(h.client.status().host, '192.168.1.99'); h.client.stop();
});
test('renews /xremote every 8 s', () => {
  const h = harness(); h.client.start(); h.advance(2000); h.offline();
  const count = () => h.sent.filter(p => p.address === '/xremote').length;
  a.equal(count(), 1); h.advance(5950); a.equal(count(), 1); h.advance(50); a.equal(count(), 2); h.advance(8000); a.equal(count(), 3); h.client.stop();
});
test('goes lost after 20 s silence and refuses writes', () => {
  const h = harness(); h.client.start(); h.advance(3000); h.offline(); h.advance(20000);
  a.equal(h.client.status().state, 'lost'); a.equal(h.client.snapshot(), null);
  const n = h.sent.length; a.equal(h.client.setSend(5,'ch/03',0.9), false); a.equal(h.client.setBusMaster(5,1), false); a.equal(h.sent.length,n); h.client.stop();
});
test('linked 5/6 shows one bus 5 with linked:true; busFor(6) === 5 when linked', () => {
  const h = harness(); h.client.start(); h.advance(3000);
  a.equal(h.client.busFor(6),5); a.equal(h.client.busFor(17),null); a.equal(h.client.busFor(1.5),null);
  a.equal(h.client.snapshot().buses.find(b => b.bus === 5).linked,true); a.ok(!h.client.snapshot().buses.some(b => b.bus === 6)); h.client.stop();
});
test('setSend writes /ch/03/mix/05/level only when connected', () => {
  const h = harness(); a.equal(h.client.setSend(5,'ch/03',1),false); h.client.start(); h.advance(3000);
  a.equal(h.client.setSend(6,'ch/03',2),true); a.deepEqual(h.desk.writes.pop(),{address:'/ch/03/mix/05/level',value:1});
  a.equal(h.client.setBusMaster(6,-1),true); a.deepEqual(h.desk.writes.pop(),{address:'/bus/05/mix/fader',value:0});
  for (const source of ['main/01','ch/33','ch/03/mix/01/level']) a.equal(h.client.setSend(5,source,0.5),false);
  for (const value of [NaN,Infinity,'0.5',null]) a.equal(h.client.setSend(5,'ch/03',value),false); h.client.stop();
});
test('desk-side level update emits level; name change emits meta', () => {
  const h = harness(); h.client.start(); h.advance(3000); const levels = [], meta = [];
  h.client.on('level', e => levels.push(e)); h.client.on('meta',e => meta.push(e));
  h.reply(encode('/ch/03/mix/05/level',[0.5])); h.reply(encode('/bus/05/mix/fader',[0.75]));
  a.deepEqual(levels,[{bus:5,source:'ch/03',value:0.5},{bus:5,source:'master',value:0.75}]);
  h.reply(encode('/ch/03/config/name',['New'])); a.deepEqual(meta,[{target:'ch/03',name:'New',color:3}]);
  a.equal(h.client.snapshot().buses.find(b => b.bus===5).sends['ch/03'],0.5); h.client.stop();
});
test('blank name keeps "" and defaultLabel gives "Ch 07"', () => {
  const h = harness(); h.client.start(); h.advance(3000);
  a.equal(h.client.snapshot().sources.find(s=>s.id==='ch/07').name,'');
  a.equal(defaultLabel('ch/07'),'Ch 07'); a.equal(defaultLabel('auxin/03'),'Aux 3'); a.equal(defaultLabel('fxrtn/02'),'FX 2'); a.equal(defaultLabel('bus/05'),'Bus 5'); h.client.stop();
});
test('incomplete load fails closed, retries dropped queries and never exceeds 200 in flight', () => {
  const h = harness(); let pending = 0, peak = 0; h.socket.send = (buf,port,host) => { const p = decode(buf); h.sent.push({host,port,...p}); if (p.address==='/xinfo') h.desk.handle(buf,h.reply); else if (p.address!=='/xremote') {pending++; peak=Math.max(peak,pending);} };
  h.client.start(); h.advance(500); a.equal(h.client.snapshot(),null); a.equal(h.client.setSend(5,'ch/03',1),false); a.ok(peak<=200);
  h.advance(4000); a.equal(h.client.status().state,'lost'); h.client.stop(); a.equal(h.timers.size,0);
});
test('wrong peer and malformed updates cannot change state; stop/start and host change clear old levels', () => {
  const h = harness(); h.client.start(); h.advance(3000);
  h.reply(encode('/bus/05/mix/fader',[1]),'192.168.1.100'); h.reply(encode('/bus/05/mix/fader',['bad']));
  a.equal(h.client.snapshot().buses.find(b=>b.bus===5).master,0);
  h.client.setHost('192.168.1.99'); a.equal(h.client.snapshot(),null); a.equal(h.client.setBusMaster(5,1),false);
  h.client.stop(); a.equal(h.timers.size,0); h.client.setHost(null); h.client.start(); h.advance(3000); a.equal(h.client.status().state,'connected'); h.client.stop();
});
test('a single dropped UDP query is retried and the recovered snapshot enables writes', () => {
  const h = harness(); let reads = 0;
  h.socket.send = (buf) => { const msg = decode(buf); if (msg.address === '/ch/03/config/name' && ++reads === 1) return; h.desk.handle(buf,h.reply); };
  h.client.start(); h.advance(1000); a.equal(h.client.snapshot(),null); h.advance(1000);
  a.equal(reads,2); a.equal(h.client.status().state,'connected'); a.equal(h.client.snapshot().sources.find(s=>s.id==='ch/03').name,'Vocal'); h.client.stop();
});
test('reconnect requires a fresh full load and never pushes old levels', () => {
  const h = harness(); h.client.start(); h.advance(2000); h.offline(); h.advance(21000);
  a.equal(h.client.status().state,'lost'); h.desk.state['/bus/05/mix/fader'] = 0.5;
  h.reply(encode('/xinfo',['192.168.1.32','Fake X32','X32','4.0']));
  a.equal(h.client.setBusMaster(5,1),false);
  h.socket.send = buf => h.desk.handle(buf,h.reply); h.advance(2000);
  a.equal(h.client.status().state,'connected'); a.equal(h.client.snapshot().buses.find(b=>b.bus===5).master,0.5); a.deepEqual(h.desk.writes,[]); h.client.stop();
});
test('link changes invalidate snapshot and reload topology before permitting writes', () => {
  const h = harness(); h.client.start(); h.advance(2000);
  h.desk.state['/config/buslink/5-6'] = 0;
  h.reply(encode('/config/buslink/5-6',[{type:'i',value:0}]));
  a.equal(h.client.snapshot(),null); a.equal(h.client.setSend(6,'ch/03',1),false); h.advance(2000);
  a.equal(h.client.busFor(6),6); a.equal(h.client.snapshot().buses.length,16); h.client.stop();
});
test('bus metadata and Main routing update snapshots; callers cannot mutate cached desk state', () => {
  const h = harness(); h.client.start(); h.advance(2000); const events = []; h.client.on('meta',e=>events.push(e));
  h.reply(encode('/bus/05/config/color',[{type:'i',value:8}])); h.reply(encode('/bus/05/mix/st',[{type:'i',value:1}]));
  a.deepEqual(events,[{target:'bus/05',name:'',color:8}]);
  const snap = h.client.snapshot(); a.equal(snap.buses.find(b=>b.bus===5).toMain,true); snap.buses[0].master=1;
  a.equal(h.client.snapshot().buses[0].master,0); h.client.stop();
});
test('discovery disabled sends nothing and ignores unsolicited identities', () => {
  const h = harness({discover:false}); h.client.start(); h.reply(encode('/xinfo',['192.168.1.32','Desk','X32','4.0'])); h.advance(4000);
  a.equal(h.sent.length,0); a.equal(h.client.snapshot(),null); h.client.stop();
});
test('socket error invalidates the snapshot and cleanup removes listeners', () => {
  const h = harness(); h.client.start(); h.advance(2000); h.socket.emit('error',Error('network down'));
  a.equal(h.client.status().state,'lost'); a.equal(h.client.setBusMaster(5,1),false); h.client.stop();
  a.equal(h.socket.listenerCount('message'),0); a.equal(h.socket.listenerCount('error'),0);
});
test('real UDP socket loads the fake desk and receives a clamped send echo', {timeout:6000}, async () => {
  const dgram = require('dgram'), {once} = require('events');
  const server = dgram.createSocket('udp4'), socket = dgram.createSocket('udp4');
  const desk = createFakeX32(); let client;
  try {
    server.bind(0,'127.0.0.1'); await once(server,'listening');
    socket.bind(0,'127.0.0.1'); await once(socket,'listening');
    server.on('message',(buf,peer) => desk.handle(buf,reply => server.send(reply,peer.port,peer.address)));
    client = createX32({socket,host:'127.0.0.1',port:server.address().port});
    const loaded = once(client,'snapshot'); client.start(); await loaded;
    a.equal(client.status().state,'connected'); a.deepEqual(desk.writes,[]);
    const update = once(client,'level'); a.equal(client.setSend(5,'auxin/08',2),true);
    a.deepEqual((await update)[0],{bus:5,source:'auxin/08',value:1});
  } finally { if (client) client.stop(); socket.close(); server.close(); }
});
test('unanswered /xinfo goes lost at 3 s and retries every 3 s', () => {
  const h = harness(); h.offline(); h.client.start(); h.advance(2950);
  a.equal(h.client.status().state,'searching'); a.equal(h.sent.length,1); h.advance(50);
  a.equal(h.client.status().state,'lost'); a.equal(h.sent.length,2); h.advance(3000);
  a.equal(h.sent.length,3); h.client.stop();
});
