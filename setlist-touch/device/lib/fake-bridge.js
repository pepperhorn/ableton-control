'use strict';
const {EventEmitter} = require('events');
function createFakeBridge(rawScenes, rawMix = {returns:[], tracks:[]}) {
  rawMix = JSON.parse(JSON.stringify(rawMix));
  const bridge = new EventEmitter();
  let playing = -1, fired = -1, position = 0, bpm = 100, timer, launchTimer;
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
  bridge.snapshot = () => { emitTransport(); bridge.emit('mix', rawMix); bridge.emit('scenes', rawScenes); emitPlay(); emitPos(); };
  bridge.simulate = options => {
    clearInterval(timer); playing = options.scene; bpm = options.bpm; position = 0; songTime = 0; is_playing = 1; bridge.snapshot();
    let last = Date.now();
    timer = setInterval(() => { const now = Date.now(), scene = row(playing); if (is_playing) { position += (now - last) / 60000 * bpm; songTime += (now - last) / 60000 * bpm; } last = now;
      if (scene && scene.loopBeats > 0) position %= scene.loopBeats; emitPos(); emitTransport(); }, 50);
    return () => { clearInterval(timer); clearTimeout(launchTimer); };
  };
  return bridge;
}
module.exports = {createFakeBridge};
