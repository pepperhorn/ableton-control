'use strict';
const {matchReturn}=require('./access');
const {EventEmitter} = require('events');
function createFakeBridge(rawScenes, rawMix = {returns:[], tracks:[]}, {slowIndex = false} = {}) {
  rawMix = JSON.parse(JSON.stringify(rawMix));
  const bridge = new EventEmitter();
  let playing = -1, fired = -1, position = 0, bpm = 100, timer, launchTimer;
  let indexTimer, indexDone = !slowIndex, indexStarted = false;
  let is_playing = 0, record_mode = 0, songTime = 0;
  const emitTransport = () => bridge.emit('transport', {is_playing, record_mode, tempo:bpm, current_song_time:songTime, signature_numerator:4, signature_denominator:4});
  bridge.transport = (command, value) => {
    if (command === 'play') is_playing = 1;
    else if (command === 'stop') { is_playing = 0; clearTimeout(launchTimer); fired = -1; emitPlay(); }
    else if (command === 'record' && (value === 0 || value === 1)) record_mode = value;
    else return;
    bridge.emit('transportCommand', {command, value}); emitTransport();
  };
  const row = i => rawScenes.find(s => s.index === i);
  const emitPlay = () => bridge.emit('play', {playing, fired});
  function emitPos() { const scene = row(playing); if (scene && scene.loopBeats > 0) bridge.emit('pos', {scene:playing, position, loopStart:0, loopEnd:scene.loopBeats, beatsPerBar:scene.beatsPerBar}); }
  bridge.fire = i => {
    clearTimeout(launchTimer); fired = i; emitPlay(); bridge.emit('fire', i);
    launchTimer = setTimeout(() => {playing = i; is_playing = 1; fired = -1; position = 0; emitTransport(); emitPlay(); emitPos();}, 60000 / bpm * ((row(i) || {}).beatsPerBar || 4));
  };
  bridge.setSend = (trackIndex, returnIndex, value) => {
    const track = rawMix.tracks.find(t => t.index === trackIndex);
    if (!track || !track.sends[returnIndex]) return;
    const label = value === 0 ? '-inf dB' : `${(20 * Math.log10(value)).toFixed(1)} dB`;
    track.sends[returnIndex] = {value, label};
    bridge.emit('setSend', {trackIndex, returnIndex, value});
    bridge.emit('level', {trackIndex, returnIndex, value, label});
  };
  rawMix.effects = rawMix.effects || rawMix.returns.filter(r => r.routedToMain === true).map(r => ({index:r.index,name:r.name,color:r.color,sends:Object.fromEntries(rawMix.returns.filter(p => p.routedToMain === false).map(p => [p.index,{value:0,label:'-inf dB'}]))}));
  const type = {identifier:'external',display_name:'Ext. Out'};
  const channels = ['1/2','3/4','5/6'].map(identifier => ({identifier,display_name:identifier}));
  bridge.playerOutputs = async () => ({ok:true,outputs:{types:[type],channels,main:{name:'Main',type,channel:channels[0]},returns:rawMix.returns.map(r => ({index:r.index,name:r.name,type:r.routedToMain ? {display_name:'Main'} : type,channel:r.routedToMain ? null : r.channel || channels[0]}))}});
  bridge.addPlayer = async value => {
    let ret = matchReturn(rawMix.returns,value.sendName.trim());
    const existed = !!ret;
    if (ret && ret.routedToMain !== false) return {ok:false,message:'This return is routed to Main and cannot be linked as a player.'};
    if (value.sendName === 'Fail') return {ok:false,message:'Simulated routing failure. Return remains in Live; no member added.'};
    if (!ret && (!value.explicitOutput || !value.channelId)) return {ok:false,message:'Choose an explicit output'};
    if (!ret) {
      if (rawMix.returns.length >= 12) return {ok:false,message:'Live allows 12 returns.'};
      ret = {index:rawMix.returns.length,name:value.sendName,color:7833753,routedToMain:false}; rawMix.returns.push(ret);
      for (const track of rawMix.tracks) track.sends[ret.index] = {value:0,label:'-inf dB'};
      for (const effect of rawMix.effects) effect.sends[ret.index] = {value:0,label:'-inf dB'};
    }
    if (!existed || value.reroute === true) ret.channel = channels.find(c => c.identifier === value.channelId); bridge.emit('mix',rawMix);
    return {ok:true,returnName:ret.name,routeKept:existed && value.explicitOutput === true && value.reroute !== true};
  };
  bridge.setEffectSend = (effectIndex,returnIndex,value) => {
    const effect = rawMix.effects.find(e => e.index === effectIndex);
    if (!effect || !effect.sends[returnIndex]) return;
    const label = value === 0 ? '-inf dB' : (20*Math.log10(value)).toFixed(1) + ' dB';
    effect.sends[returnIndex] = {value,label}; bridge.emit('effectLevel',{effectIndex,returnIndex,value,label});
  };
  bridge.snapshot = () => {
    emitTransport(); bridge.emit('mix', rawMix);
    if (indexDone) { bridge.emit('scenes', rawScenes); emitPlay(); emitPos(); return; }
    if (indexStarted) return;
    indexStarted = true;
    const total = rawScenes.length; let done = 0;
    bridge.emit('progress', {done, total});
    indexTimer = setInterval(() => {
      done = Math.min(total, done + Math.max(1, Math.ceil(total / 40)));
      if (done === total) {
        clearInterval(indexTimer); indexDone = true;
        bridge.emit('scenes', rawScenes); emitPlay(); emitPos();
      }
      bridge.emit('progress', {done, total});
    }, 200);
  };
  bridge.simulate = options => {
    clearInterval(timer); playing = options.scene; bpm = options.bpm; position = 0; songTime = 0; is_playing = 1; bridge.snapshot();
    let last = Date.now();
    timer = setInterval(() => { const now = Date.now(), scene = row(playing); if (is_playing) { position += (now - last) / 60000 * bpm; songTime += (now - last) / 60000 * bpm; } last = now;
      if (scene && scene.loopBeats > 0) position %= scene.loopBeats; emitPos(); emitTransport(); }, 50);
    return () => { clearInterval(timer); clearInterval(indexTimer); clearTimeout(launchTimer); };
  };
  return bridge;
}
module.exports = {createFakeBridge};
