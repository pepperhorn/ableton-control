'use strict';
const {createApp} = require('./lib/app');
const {createFakeBridge} = require('./lib/fake-bridge');
const {loadConfig} = require('./lib/config');
const fixture = require('./lib/fixture-rise.json');
const bridge = createFakeBridge(fixture, require('./lib/fixture-mix.json'), {slowIndex:process.env.SETLIST_TOUCH_SLOW_INDEX === '1'}), config = loadConfig();
if (process.env.SETLIST_TOUCH_PORT) config.port = Number(process.env.SETLIST_TOUCH_PORT);
const app = createApp({bridge, config});
bridge.on('setSend', value => console.log('setSend', JSON.stringify(value)));
bridge.on('transportCommand', value => console.log('transport', JSON.stringify(value)));
bridge.on('fire', index => console.log('fire', index));
app.listen(config.port).then(port => {
  console.log(`Setlist Touch fixture: http://localhost:${port}/ (0.0.0.0)`);
  const stop = bridge.simulate({scene:fixture.find(s => s.name === '[N32] AA').index, bpm:100});
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {stop(); await app.close(); process.exit(0);});
}).catch(error => {console.error(error.message); process.exitCode = 1;});
