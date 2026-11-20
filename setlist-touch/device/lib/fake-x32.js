'use strict';
const {encode,decode} = require('./osc');
const pad = n => String(n).padStart(2,'0');
// Partial fixture arrays override a complete desk. linked contains odd bus numbers;
// toMain contains bus numbers. state is an address -> scalar map; mutate it then
// reply(encode(address,[state[address]])) to simulate an external desk move.
function createFakeX32({buses = [], sources = [], linked = [], toMain = [], echoWrites = true} = {}) {
  const state = {}, writes = [];
  const allSources = [];
  for (const [kind,count] of [['ch',32],['auxin',8],['fxrtn',8]]) {
    for (let n=1;n<=count;n++) {
      const id = `${kind}/${pad(n)}`, source = sources.find(s => s.id === id) || {};
      allSources.push(id); state[`/${id}/config/name`] = source.name || '';
      state[`/${id}/config/color`] = source.color || 0;
    }
  }
  for (let n=1;n<=16;n++) {
    const bus = buses.find(b => b.bus === n) || {}, prefix = `/bus/${pad(n)}`;
    state[`${prefix}/config/name`] = bus.name || '';
    state[`${prefix}/config/color`] = bus.color || 0;
    state[`${prefix}/mix/st`] = bus.toMain || toMain.includes(n) ? 1 : 0;
    state[`${prefix}/mix/fader`] = bus.master || 0;
    if (n % 2) state[`/config/buslink/${n}-${n+1}`] = bus.linked || linked.includes(n) ? 1 : 0;
    for (const id of allSources) state[`/${id}/mix/${pad(n)}/level`] = (bus.sends || {})[id] || 0;
  }
  function handle(buf, reply) {
    const msg = decode(buf); if (!msg) return;
    const {address,args} = msg;
    if (address === '/xinfo' && !args.length) { reply(encode('/xinfo',['192.168.1.32','Fake X32','X32','4.0'])); return; }
    if (address === '/xremote') return;
    if (!Object.prototype.hasOwnProperty.call(state,address)) return;
    if (args.length) {
      // The fake also refuses all non-fader writes, making write scope testable.
      if (!/^\/(?:ch|auxin|fxrtn)\/\d{2}\/mix\/\d{2}\/level$|^\/bus\/\d{2}\/mix\/fader$/.test(address) || args.length !== 1 || typeof args[0] !== 'number' || args[0] < 0 || args[0] > 1) return;
      state[address] = args[0]; writes.push({address,value:args[0]});
      if (!echoWrites) return;
    }
    const value = state[address];
    reply(encode(address,[/\/color$|\/st$|\/buslink\//.test(address) ? {type:'i',value} : value]));
  }
  return {handle,state,writes};
}
module.exports = {createFakeX32};
