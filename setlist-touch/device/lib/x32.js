'use strict';
const {EventEmitter} = require('events');
const {encode,decode} = require('./osc');
const pad = n => String(n).padStart(2,'0');
const clone = value => JSON.parse(JSON.stringify(value));
const validLevel = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
function levelToDb(value) {
  const v = Math.max(0,Math.min(1,value));
  if (v === 0) return '-inf dB';
  const db = v >= 0.5 ? v*40-30 : v >= 0.25 ? v*80-50 : v >= 0.0625 ? v*160-70 : v*480-90;
  return `${(Math.abs(db) < 0.05 ? 0 : db).toFixed(1)} dB`;
}
function defaultLabel(target) {
  const [kind,number] = String(target).split('/'), n = Number(number);
  return kind === 'ch' ? `Ch ${pad(n)}` : kind === 'auxin' ? `Aux ${n}` : kind === 'fxrtn' ? `FX ${n}` : kind === 'bus' ? `Bus ${n}` : String(target);
}
function createX32({socket,host = null,discover = true,port = 10023,setTimer = setTimeout,clearTimer = clearTimeout,now = Date.now}) {
  const client = new EventEmitter();
  let manual = host, peer = null, running = false, timer = null, listening = false, generation = 0;
  let lastStatus = null;
  let state = 'searching', name = '', model = '', snapshot = null, loading = null;
  let lastPacket = 0, nextProbe = 0, probeDeadline = null, nextRemote = 0;
  let queue = [], pending = new Map(), fields = new Map(), links = new Map(), phase = '';
  client.status = () => ({state,host:peer || manual,name,model});
  client.snapshot = () => snapshot ? clone(snapshot) : null;
  function emitStatus() {
    const status = client.status(), key = JSON.stringify(status);
    if (key === lastStatus) return;
    lastStatus = key; client.emit('status',status);
  }
  function discard() { generation++; snapshot = null; loading = null; queue = []; pending.clear(); fields.clear(); links.clear(); phase = ''; }
  function lost() {
    discard(); state = 'lost'; probeDeadline = null; nextProbe = now()+3000; emitStatus();
  }
  function send(address,args = [], destination = peer) {
    if (!running || !destination) return false;
    const epoch = generation;
    try {
      socket.send(encode(address,args),port,destination,error => { if (error && running && epoch === generation && destination === peer) lost(); });
      return true;
    } catch (_) { lost(); return false; }
  }
  function probe() {
    const destination = manual || (discover ? '255.255.255.255' : null);
    nextProbe = now()+3000; probeDeadline = now()+3000;
    if (!destination) { probeDeadline = null; return; }
    try { if (!manual) socket.setBroadcast(true); } catch (_) { lost(); return; }
    send('/xinfo',[],destination);
  }
  function add(address, descriptor) { fields.set(address,descriptor); queue.push(address); }
  function busFor(n) {
    if (!Number.isInteger(n) || n < 1 || n > 16) return null;
    return n % 2 === 0 && links.get(n-1) === 1 ? n-1 : n;
  }
  client.busFor = busFor;
  function beginLoad() {
    discard(); state = 'searching'; loading = {sources:[],buses:[]}; phase = 'links';
    for (let n=1;n<16;n+=2) add(`/config/buslink/${n}-${n+1}`,{kind:'link',bus:n});
    nextRemote = now()+8000; send('/xremote'); send('/xinfo'); emitStatus();
  }
  function addContent() {
    phase = 'content';
    for (const [kind,count] of [['ch',32],['auxin',8],['fxrtn',8]]) {
      for (let n=1;n<=count;n++) {
        const source = {id:`${kind}/${pad(n)}`,kind,number:n,name:'',color:0}; loading.sources.push(source);
        add(`/${source.id}/config/name`,{kind:'name',target:source});
        add(`/${source.id}/config/color`,{kind:'color',target:source});
      }
    }
    for (let n=1;n<=16;n++) {
      if (busFor(n) !== n) continue;
      const bus = {bus:n,name:'',color:0,linked:links.get(n)===1,toMain:false,master:0,sends:{}}; loading.buses.push(bus);
      const prefix = `/bus/${pad(n)}`;
      for (const [suffix,kind] of [['config/name','name'],['config/color','color'],['mix/st','toMain'],['mix/fader','master']]) add(`${prefix}/${suffix}`,{kind,target:bus});
      for (const source of loading.sources) add(`/${source.id}/mix/${pad(n)}/level`,{kind:'send',target:bus,source:source.id});
    }
  }
  function finishPhase() {
    if (!loading || queue.length || pending.size) return;
    if (phase === 'links') { addContent(); return; }
    snapshot = loading; loading = null; state = 'connected'; phase = '';
    emitStatus(); client.emit('snapshot',client.snapshot());
  }
  function valid(descriptor,value) {
    if (descriptor.kind === 'name') return typeof value === 'string';
    if (descriptor.kind === 'color') return Number.isInteger(value) && value >= 0 && value <= 15;
    if (descriptor.kind === 'link' || descriptor.kind === 'toMain') return value === 0 || value === 1;
    return validLevel(value);
  }
  function message(buf,rinfo) {
    if (!running || !rinfo || rinfo.port !== port) return;
    const msg = decode(buf); if (!msg) return;
    if (msg.address === '/xinfo') {
      if (!manual && !discover) return;
      if (manual && rinfo.address !== manual || peer && rinfo.address !== peer && (loading || state === 'connected')) return;
      if (msg.args.length !== 4 || !msg.args.every(v => typeof v === 'string')) return;
      lastPacket = now(); probeDeadline = null;
      if (state === 'connected' || loading) return;
      peer = rinfo.address; name = msg.args[1]; model = msg.args[2]; beginLoad(); return;
    }
    if (rinfo.address !== peer || (!loading && state !== 'connected')) return;
    lastPacket = now();
    const descriptor = fields.get(msg.address);
    if (!descriptor || msg.args.length !== 1 || !valid(descriptor,msg.args[0])) return;
    const value = msg.args[0], wasLoading = !!loading;
    if (descriptor.kind === 'link') {
      if ((!wasLoading || phase === 'content') && links.get(descriptor.bus) !== value) { beginLoad(); return; }
      links.set(descriptor.bus,value);
    } else {
      const target = descriptor.target;
      if (descriptor.kind === 'send') target.sends[descriptor.source] = value;
      else if (descriptor.kind === 'toMain') target.toMain = value === 1;
      else target[descriptor.kind] = value;
      if (!wasLoading) {
        if (descriptor.kind === 'send' || descriptor.kind === 'master') client.emit('level',{bus:target.bus,source:descriptor.source || 'master',value});
        if (descriptor.kind === 'name' || descriptor.kind === 'color') client.emit('meta',{target:target.id || `bus/${pad(target.bus)}`,name:target.name,color:target.color});
        // Routing changes must be visible to consumers of full snapshots, too.
        if (descriptor.kind === 'toMain') client.emit('snapshot',client.snapshot());
      }
    }
    pending.delete(msg.address); finishPhase();
  }
  function tick() {
    timer = null; if (!running) return;
    if ((loading || state === 'connected') && now()-lastPacket >= 20000) lost();
    if (probeDeadline !== null && now() >= probeDeadline) { lost(); nextProbe = now(); }
    if (!loading && state !== 'connected' && now() >= nextProbe) probe();
    if ((loading || state === 'connected') && now() >= nextRemote) { nextRemote = now()+8000; send('/xremote'); send('/xinfo'); }
    // At most 40 queries per 50 ms tick, at most 100 outstanding. Retry lost
    // UDP reads twice; a missing field never becomes a fabricated live value.
    let budget = 40;
    for (const [address,request] of pending) {
      if (now()-request.at < 1000) continue;
      if (request.tries >= 3) { lost(); break; }
      if (!budget--) break;
      request.at = now(); request.tries++; send(address);
    }
    while (running && loading && budget > 0 && queue.length && pending.size < 100) {
      budget--; const address = queue.shift(); pending.set(address,{at:now(),tries:1}); send(address);
    }
    if (running && timer === null) timer = setTimer(tick,50);
  }
  client.start = () => {
    if (running) return;
    running = true; peer = null; name = ''; model = ''; state = 'searching'; discard();
    if (!listening) { socket.on('message',message); socket.on('error',onError); listening = true; }
    emitStatus(); probe();
    if (running && timer === null) timer = setTimer(tick,50);
  };
  function onError() { if (running) lost(); }
  client.stop = () => {
    running = false; if (timer !== null) clearTimer(timer); timer = null;
    // Socket ownership remains with the caller; do not close a shared socket.
    if (socket.removeListener) { socket.removeListener('message',message); socket.removeListener('error',onError); listening = false; }
    discard(); peer = null; state = 'lost'; probeDeadline = null; emitStatus();
  };
  client.setHost = ip => {
    manual = ip; peer = null; name = ''; model = ''; discard(); state = 'searching'; probeDeadline = null;
    emitStatus(); if (running) probe();
  };
  function write(bus,source,value) {
    if (state !== 'connected' || !snapshot || typeof value !== 'number' || !Number.isFinite(value)) return false;
    const n = busFor(bus), target = snapshot.buses.find(b => b.bus === n);
    if (!target || source !== 'master' && !snapshot.sources.some(s => s.id === source)) return false;
    const address = source === 'master' ? `/bus/${pad(n)}/mix/fader` : `/${source}/mix/${pad(n)}/level`;
    const sent = send(address,[Math.max(0,Math.min(1,value))]);
    // Read authoritative desk state even when writes are not echoed to us.
    if (sent && state === 'connected' && snapshot) send(address);
    return sent;
  }
  client.setSend = (bus,source,value) => source !== 'master' && write(bus,source,value);
  client.setBusMaster = (bus,value) => write(bus,'master',value);
  return client;
}
module.exports = {createX32,levelToDb,defaultLabel};
