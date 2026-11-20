'use strict';
const {can} = require('./access');
const {levelToDb,defaultLabel} = require('./x32');
// All delayed work rechecks identity, mode and freshness at its write boundary.
function createX32Mix({x32,config,send,now = Date.now}) {
  const writes = new Map(), clients = new Map(), seen = new Map();
  const busFor = n => x32 ? x32.busFor(n) : n;
  const allowed = (identity,bus) => can(identity,'busSend',bus,busFor);
  let desk, sharedSources;
  const views = new Map();
  // The client returns a defensive deep copy. Read it once per desk change,
  // never from readiness checks or separately for each connected phone.
  const snapshot = () => {
    if (desk === undefined) desk = x32 ? x32.snapshot() : null;
    return desk;
  };
  function invalidate() { desk = undefined; sharedSources = undefined; views.clear(); }
  const ready = () => x32 && config().mixSource === 'x32' && x32.status().state === 'connected' && snapshot();
  function view(identity,memberId) {
    const data = snapshot() || {buses:[],sources:[]};
    const member = identity.kind === 'admin' && memberId ? config().members.find(m => m.id === memberId) : identity.member;
    const assigned = [...new Set((member && member.buses || []).map(busFor))];
    const permitted = data.buses.filter(b => allowed(identity,b.bus));
    const key = permitted.map(b => b.bus).join(',');
    let shared = views.get(key);
    if (!shared) {
      const levels = {};
      for (const bus of permitted) levels[bus.bus] = Object.fromEntries(Object.entries({master:bus.master,...bus.sends}).map(([id,value]) => [id,{value,label:levelToDb(value)}]));
      if (!sharedSources) sharedSources = data.sources.map(s => ({...s,unnamed:!s.name.trim(),name:s.name.trim() || defaultLabel(s.id)}));
      shared = {buses:permitted.map(b => ({...b,name:b.name.trim() || defaultLabel('bus/'+b.bus)})),sources:sharedSources,levels,defaults:sharedSources.filter(s => s.unnamed).map(s => s.id)};
      views.set(key,shared);
    }
    const buses = shared.buses.slice().sort((a,b) => (a.bus === assigned[0] ? -1 : b.bus === assigned[0] ? 1 : a.bus-b.bus));
    const hidden = {};
    for (const bus of buses) {
      // An explicit empty list means the musician has shown every source.
      const lists = member && member.hidden || {};
      const list = lists[bus.bus] || Object.entries(lists).find(([n]) => busFor(Number(n)) === bus.bus)?.[1];
      hidden[bus.bus] = list === undefined ? shared.defaults : list;
    }
    return {mixSource:config().mixSource,status:x32 ? x32.status() : {state:'searching',host:config().x32Host,name:'',model:''},
      buses,sources:shared.sources,levels:shared.levels,hidden,
      unavailableBuses:assigned.filter(n => !data.buses.some(b => b.bus === n))};
  }
  function clear(map) { for (const entry of map.values()) clearTimeout(entry.timer); map.clear(); }
  function reset() {
    clear(writes); seen.clear();
    for (const b of (snapshot() || {buses:[]}).buses) for (const [source,value] of Object.entries({master:b.master,...b.sends})) seen.set(b.bus+':'+source,value);
    for (const c of clients.values()) clear(c.levels);
  }
  function full() { for (const [res,c] of clients) send(res,'x32',view(c.identityOf(),c.memberId)); }
  function refresh() { invalidate(); reset(); full(); }
  function metadata() { invalidate(); full(); }
  function onLevel(level) {
    if (!ready() || !level || !Number.isFinite(level.value)) return;
    const key = level.bus+':'+level.source;
    if (seen.get(key) === level.value) return;
    seen.set(key,level.value);
    // Keep our defensive copy current without recopying the entire desk.
    const bus = snapshot().buses.find(b => b.bus === level.bus);
    if (bus) {
      if (level.source === 'master') bus.master = level.value;
      else bus.sends[level.source] = level.value;
    }
    views.clear();
    for (const [res,c] of clients) {
      if (!allowed(c.identityOf(),level.bus)) continue;
      let entry = c.levels.get(key);
      if (!entry) { entry = {last:-Infinity}; c.levels.set(key,entry); }
      entry.pending = {...level,label:levelToDb(level.value)};
      const flush = () => {
        entry.timer = null; const value = entry.pending; entry.pending = null;
        if (value && ready() && allowed(c.identityOf(),value.bus)) { entry.last = now(); send(res,'x32level',value); }
      };
      const delay = 100-(now()-entry.last);
      if (delay <= 0) flush(); else if (!entry.timer) entry.timer = setTimeout(flush,delay);
    }
  }
  reset();
  if (x32) { x32.on('status',refresh); x32.on('snapshot',refresh); x32.on('meta',metadata); x32.on('level',onLevel); }
  return {view,allowed,busFor,ready,snapshot,refresh,
    connect(res,identityOf,memberId) { const c = {identityOf,memberId,levels:new Map()}; clients.set(res,c); send(res,'x32',view(identityOf(),memberId)); res.on('close',()=>{clear(c.levels);clients.delete(res);}); },
    write(value,identityOf) {
      const key = value.bus+':'+value.source;
      let entry = writes.get(key); if (!entry) { entry = {last:-Infinity}; writes.set(key,entry); }
      entry.pending = value; entry.identityOf = identityOf;
      const flush = () => {
        entry.timer = null; const v = entry.pending; entry.pending = null;
        if (!v || !ready() || !allowed(entry.identityOf(),v.bus) || !snapshot().buses.some(b => b.bus === v.bus)) return;
        entry.last = now();
        if (v.source === 'master') x32.setBusMaster(v.bus,v.value); else x32.setSend(v.bus,v.source,v.value);
      };
      const delay = 50-(now()-entry.last);
      if (delay <= 0) flush(); else if (!entry.timer) entry.timer = setTimeout(flush,delay);
    },
    close() { reset();clients.clear();if (x32) {x32.removeListener('status',refresh);x32.removeListener('snapshot',refresh);x32.removeListener('meta',metadata);x32.removeListener('level',onLevel);} }
  };
}
module.exports = {createX32Mix};
