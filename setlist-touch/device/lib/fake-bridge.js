'use strict';
const {EventEmitter} = require('events');
function createFakeBridge(rawScenes, rawMix = {returns:[], tracks:[]}) {
  rawMix = JSON.parse(JSON.stringify(rawMix));
  const bridge = new EventEmitter();
  let playing = -1, fired = -1, position = 0, bpm = 100, timer, launchTimer;
  const row = i => rawScenes.find(s => s.index === i);
  const emitPlay = () => bridge.emit('play', {playing, fired});
  function emitPos() { const scene = row(playing); if (scene && scene.loopBeats > 0) bridge.emit('pos', {scene:playing, position, loopStart:0, loopEnd:scene.loopBeats, beatsPerBar:scene.beatsPerBar}); }
  bridge.fire = i => {
    clearTimeout(launchTimer); fired = i; emitPlay(); bridge.emit('fire', i);
    launchTimer = setTimeout(() => {playing = i; fired = -1; position = 0; emitPlay(); emitPos();}, 60000 / bpm * ((row(i) || {}).beatsPerBar || 4));
  };
  bridge.setSend = (trackIndex, returnIndex, value) => {
    const track = rawMix.tracks.find(t => t.index === trackIndex);
    if (!track || !track.sends[returnIndex]) return;
    const label = value === 0 ? '-inf dB' : `${(20 * Math.log10(value)).toFixed(1)} dB`;
    track.sends[returnIndex] = {value, label};
    bridge.emit('setSend', {trackIndex, returnIndex, value});
    bridge.emit('level', {trackIndex, returnIndex, value, label});
  };
  bridge.snapshot = () => { bridge.emit('mix', rawMix); bridge.emit('scenes', rawScenes); emitPlay(); emitPos(); };
  bridge.simulate = options => {
    clearInterval(timer); playing = options.scene; bpm = options.bpm; position = 0; bridge.snapshot();
    let last = Date.now();
    timer = setInterval(() => { const now = Date.now(), scene = row(playing); position += (now - last) / 60000 * bpm; last = now;
      if (scene && scene.loopBeats > 0) position %= scene.loopBeats; emitPos(); }, 50);
    return () => { clearInterval(timer); clearTimeout(launchTimer); };
  };
  return bridge;
}
module.exports = {createFakeBridge};
