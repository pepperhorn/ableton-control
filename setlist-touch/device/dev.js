'use strict';
const {createApp} = require('./lib/app');
const {createFakeBridge} = require('./lib/fake-bridge');
const {EventEmitter} = require('events');
const {createX32} = require('./lib/x32');
const {createFakeX32} = require('./lib/fake-x32');
const fixture = require('./lib/fixture-rise.json');
const bridge = createFakeBridge(fixture, require('./lib/fixture-mix.json'), {slowIndex:process.env.SETLIST_TOUCH_SLOW_INDEX === '1'}), config = {port:8765,username:'band',password:'',accessEnabled:false,members:[]};
if (process.env.SETLIST_TOUCH_PORT) config.port = Number(process.env.SETLIST_TOUCH_PORT);
let x32;
if (process.env.SETLIST_TOUCH_FAKE_X32 === '1') {
  const fake = createFakeX32({linked:[5],sources:[{id:'ch/01',name:'Vox',color:3},{id:'ch/02',name:'Guitar',color:5}],buses:[{bus:5,name:'Shaun',master:0.6}]});
  const socket = new EventEmitter();
  socket.setBroadcast = () => {};
  socket.send = (buf,port,host,callback) => {
    fake.handle(buf,reply => setImmediate(() => socket.emit('message',reply,{address:'192.168.1.32',port:10023})));
    if (callback) callback();
  };
  x32 = createX32({socket}); x32.start();
}
const app = createApp({bridge,x32, config, saveConfig:async () => {}});
bridge.on('setSend', value => console.log('setSend', JSON.stringify(value)));
bridge.on('transportCommand', value => console.log('transport', JSON.stringify(value)));
bridge.on('fire', index => console.log('fire', index));
app.listen(config.port).then(port => {
  console.log(`Setlist Touch fixture: http://127.0.0.1:${port}/ (0.0.0.0)`);
  const stop = bridge.simulate({scene:fixture.find(s => s.name === '[N32] AA').index, bpm:100});
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {stop(); if (x32) x32.stop(); await app.close(); process.exit(0);});
}).catch(error => {if (x32) x32.stop(); console.error(error.message); process.exitCode = 1;});
