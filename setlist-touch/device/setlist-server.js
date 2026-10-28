'use strict';
const max = require('max-api');
const os = require('os');
const {EventEmitter} = require('events');
const {createApp} = require('./lib/app');
const {loadConfig, saveConfig} = require('./lib/config');
const bridge = new EventEmitter();
bridge.fire = (index, name) => max.outlet('fire', index, name);
let sceneRead = Promise.resolve();
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
function address(port) {
  const interfaces = Object.values(os.networkInterfaces()).flat();
  const ip = interfaces.find(i => (i.family === 'IPv4' || i.family === 4) && !i.internal);
  max.outlet('address', `http://${ip ? ip.address : 'localhost'}:${port}`);
  max.outlet('url', `http://localhost:${port}/`);
}
bridge.addressChanged = address;
const app = createApp({bridge, config:loadConfig(), saveConfig});
app.listen(app.getConfig().port).then(port => {
  address(port);
  // Node startup can finish after live.thisdevice; request a fresh snapshot.
  max.outlet('ready');
}).catch(error => {max.post('Setlist Touch: ' + error.message);});
process.on('SIGTERM', () => app.close().then(() => process.exit(0)));
