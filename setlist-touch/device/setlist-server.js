'use strict';
const max = require('max-api');
const os = require('os');
const {EventEmitter} = require('events');
const {createApp} = require('./lib/app');
const {loadConfig, saveConfig} = require('./lib/config');
const bridge = new EventEmitter();
let lastMix = {returns:[], tracks:[]};
bridge.setSend = (trackIndex, returnIndex, value) => {
  const track = lastMix.tracks.find(t => t.index === trackIndex);
  const ret = lastMix.returns.find(r => r.index === returnIndex);
  if (track && ret) max.outlet('send', trackIndex, returnIndex, value, track.name, ret.name);
};
let playerSerial = 0;
const playerRequests = new Map();
function playerRequest(command, ...args) {
  const id = ++playerSerial;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { playerRequests.delete(id); reject(Error('Live did not reply. Check the return in Live before trying again.')); }, 10000);
    playerRequests.set(id,{resolve,reject,timer}); max.outlet('players',command,id,...args);
  });
}
bridge.playerOutputs = () => playerRequest('outputs');
bridge.addPlayer = value => playerRequest('add',value.sendName,value.typeId,value.channelId,JSON.stringify({explicitOutput:value.explicitOutput === true,reroute:value.reroute === true,expectedRouting:value.expectedRouting}));
max.addHandler('playerResult', async id => {
  const entry = playerRequests.get(id); if (!entry) { max.outlet('players','forget',id); return; }
  try { const dict = await max.getDict('setlist_touch_player_' + id); const result = JSON.parse(dict.result); clearTimeout(entry.timer); playerRequests.delete(id); entry.resolve(result); }
  catch (_) { clearTimeout(entry.timer); playerRequests.delete(id); entry.reject(Error('Unreadable Live reply')); }
  finally { max.outlet('players','forget',id); }
});
max.addHandler('playerRemoved', () => { for (const entry of playerRequests.values()) { clearTimeout(entry.timer); entry.reject(Error('Device removed')); } playerRequests.clear(); bridge.emit('playerRemoved'); });
let timingSerial = 0, timingPending = null;
bridge.buildTiming = value => {
  if (timingPending) return Promise.resolve({ok:false,message:'Another build is in progress'});
  return new Promise((resolve,reject) => {
    const id = ++timingSerial;
    const expire = () => { timingPending = null; max.outlet('timing','timingCancel',id); reject(Error('Live stopped replying. Check timing clips in Live before retrying.')); };
    timingPending = {id,resolve,reject,expire,timer:setTimeout(expire,10000)};
    max.outlet('timing','timingBuild',id,value.confirmPlaying === true ? 1 : 0);
  });
};
max.addHandler('timingProgress', (done,total) => {
  if (!timingPending) return;
  clearTimeout(timingPending.timer); timingPending.timer = setTimeout(timingPending.expire,10000);
  bridge.emit('timingProgress',{done,total});
  max.outlet('address', 'Building timing clips ' + done + ' / ' + total);
});
max.addHandler('timingResult', async id => {
  const entry = timingPending;
  try {
    if (!entry || entry.id !== id) return;
    const dict = await max.getDict('setlist_touch_timing_' + id);
    entry.resolve(JSON.parse(dict.result));
  } catch (_) { if (entry) entry.reject(Error('Unreadable Live reply; check timing clips in Live')); }
  finally {
    max.outlet('timing','timingForget',id);
    if (entry && entry.id === id) { clearTimeout(entry.timer); if (timingPending === entry) timingPending = null; }
    if (lastAddress && !indexing) max.outlet('address',lastAddress);
  }
});
bridge.setEffectSend = (effectIndex, returnIndex, value) => {
  const effect = (lastMix.effects || []).find(e => e.index === effectIndex), ret = lastMix.returns.find(r => r.index === returnIndex);
  if (effect && ret) max.outlet('effectSend',effectIndex,returnIndex,value,effect.name,ret.name);
};
max.addHandler('effectLevel', (effectIndex, returnIndex, value, ...label) => {
  mixRead.then(() => bridge.emit('effectLevel',{effectIndex,returnIndex,value,label:label.join(' ')}));
});
bridge.transport = (command, value) => command === 'record' ? max.outlet('transport', command, value) : max.outlet('transport', command);
max.addHandler('transport', (is_playing, record_mode, tempo, current_song_time, signature_numerator, signature_denominator, beats_song_time) => {
  bridge.emit('transport', {is_playing, record_mode, tempo, current_song_time, signature_numerator, signature_denominator, beats_song_time});
});
bridge.fire = (index, name) => max.outlet('fire', index, name);
let sceneRead = Promise.resolve();
let lastAddress = '', indexing = false, startupFailed = false;
max.addHandler('progress', (done, total) => {
  if (!Number.isInteger(done) || !Number.isInteger(total) || done < 0 || total < done) return;
  // Completion follows the final Dict read, so clients keep the status until the set arrives.
  sceneRead.then(() => {
    indexing = done < total;
    bridge.emit('progress', {done, total});
    if (indexing && !startupFailed) max.outlet('progress', done, total);
    else if (lastAddress) max.outlet('address', lastAddress);
  });
});
max.addHandler('scenes', () => {
  sceneRead = sceneRead.then(async () => {
    const dict = await max.getDict('setlist_touch_scenes');
    bridge.emit('scenes', JSON.parse(dict.scenes));
  }).catch(error => max.post('Scene read failed: ' + error.message));
});
max.addHandler('play', (playing, fired) => {
  sceneRead.then(() => bridge.emit('play', {playing, fired}));
});
max.addHandler('pos', (scene, position, loopStart, loopEnd, beatsPerBar) => {
  sceneRead.then(() => bridge.emit('pos', {scene, position, loopStart, loopEnd, beatsPerBar}));
});
let mixRead = Promise.resolve();
max.addHandler('mix', () => {
  mixRead = mixRead.then(async () => {
    const dict = await max.getDict('setlist_touch_mix');
    lastMix = JSON.parse(dict.mix);
    bridge.emit('mix', lastMix);
  }).catch(error => max.post('Mix read failed: ' + error.message));
});
max.addHandler('level', (trackIndex, returnIndex, value, ...label) => {
  mixRead.then(() => bridge.emit('level', {trackIndex, returnIndex, value, label:label.join(' ')}));
});
function address(port) {
  const interfaces = Object.values(os.networkInterfaces()).flat();
  const ip = interfaces.find(i => (i.family === 'IPv4' || i.family === 4) && !i.internal);
  const note = app.getPortNote();
  lastAddress = (note ? note + '\n' : '') + `http://${ip ? ip.address : 'localhost'}:${port}`;
  if (!indexing) max.outlet('address', lastAddress);
  max.outlet('url', `http://localhost:${port}/`);
}
bridge.addressChanged = address;
const app = createApp({bridge, config:loadConfig(), saveConfig});
app.listenWithFallback(app.getConfig().port).then(port => {
  address(port);
  // Node startup can finish after live.thisdevice; request a fresh snapshot.
  max.outlet('ready');
}).catch(error => {startupFailed = true; lastAddress = error.message; indexing = false; max.outlet('address', lastAddress); max.post('Setlist Touch: ' + error.message);});
process.on('SIGTERM', () => app.close().then(() => process.exit(0)));
