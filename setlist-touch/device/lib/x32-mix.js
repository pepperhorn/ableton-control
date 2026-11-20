'use strict';
const {can} = require('./access');
const {levelToDb,defaultLabel} = require('./x32');
// All delayed work rechecks identity, mode and freshness at its write boundary.
function createX32Mix({x32,config,send,now = Date.now}) {
  const writes = new Map(), clients = new Map(), seen = new Map();
  const busFor = n => x32 ? x32.busFor(n) : n;
  const allowed = (identity,bus) => can(identity,'busSend',bus,busFor);
  const snapshot = () => x32 && x32.snapshot();
  const ready = () => x32 && config().mixSource === 'x32' && x32.status().state === 'connected' && snapshot();
  function view(identity,memberId) {
    const data = snapshot() || {buses:[],sources:[]};
    const member = identity.kind === 'admin' && memberId ? config().members.find(m => m.id === memberId) : identity.member;
    const assigned = [...new Set((member && member.buses || []).map(busFor))];
    const buses = data.buses.filter(b => allowed(identity,b.bus));
    buses.sort((a,b) => (a.bus === assigned[0] ? -1 : b.bus === assigned[0] ? 1 : a.bus-b.bus));
    const levels = {}, hidden = {};
    for (const bus of buses) {
      levels[bus.bus] = Object.fromEntries(Object.entries({master:bus.master,...bus.sends}).map(([id,value]) => [id,{value,label:levelToDb(value)}]));
      // An explicit empty list means the musician has shown every source.
      const lists = member && member.hidden || {};
      const list = lists[bus.bus] || Object.entries(lists).find(([n]) => busFor(Number(n)) === bus.bus)?.[1];
      hidden[bus.bus] = list === undefined ? data.sources.filter(s => !s.name.trim()).map(s => s.id) : list;
    }
    return {mixSource:config().mixSource,status:x32 ? x32.status() : {state:'searching',host:config().x32Host,name:'',model:''},
      buses:buses.map(b => ({...b,name:b.name.trim() || defaultLabel('bus/'+b.bus)})),
      sources:data.sources.map(s => ({...s,unnamed:!s.name.trim(),name:s.name.trim() || defaultLabel(s.id)})),levels,hidden,
      unavailableBuses:assigned.filter(n => !data.buses.some(b => b.bus === n))};
  }
  function clear(map) { for (const entry of map.values()) clearTimeout(entry.timer); map.clear(); }
  function reset() {
    clear(writes); seen.clear();
    for (const b of (snapshot() || {buses:[]}).buses) for (const [source,value] of Object.entries({master:b.master,...b.sends})) seen.set(b.bus+':'+source,value);
    for (const c of clients.values()) clear(c.levels);
  }
  function full() { for (const [res,c] of clients) send(res,'x32',view(c.identityOf(),c.memberId)); }
  function refresh() { reset(); full(); }
  function onLevel(level) {
    if (!ready() || !level || !Number.isFinite(level.value)) return;
    const key = level.bus+':'+level.source;
    if (seen.get(key) === level.value) return;
    seen.set(key,level.value);
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
  if (x32) { x32.on('status',refresh); x32.on('snapshot',refresh); x32.on('meta',full); x32.on('level',onLevel); }
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
    close() { reset();clients.clear();if (x32) {x32.removeListener('status',refresh);x32.removeListener('snapshot',refresh);x32.removeListener('meta',full);x32.removeListener('level',onLevel);} }
  };
}
module.exports = {createX32Mix};
