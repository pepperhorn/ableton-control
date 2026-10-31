const {test}=require('node:test');const a=require('node:assert/strict');
const http=require('http'),path=require('path');const {EventEmitter}=require('events');
const {createApp}=require('../device/lib/app');const fixture=require('../device/lib/fixture-rise.json');
async function setup(t,remoteAddress,ready=true,password='pw'){const bridge=new EventEmitter();bridge.fires=[];bridge.fire=(i,name)=>bridge.fires.push([i,name]);const saved=[];const app=createApp({bridge,config:{port:8765,username:'band',password},saveConfig:c=>saved.push(c),webRoot:path.join(__dirname,'../device/web'),remoteAddressOf:remoteAddress?()=>remoteAddress:undefined});const port=await app.listen(0);if(ready)bridge.emit('scenes',fixture);bridge.emit('play',{playing:23,fired:-1});bridge.emit('pos',{scene:23,position:42,loopStart:0,loopEnd:128,beatsPerBar:4});t.after(()=>app.close());return {bridge,app,port,saved};}
function req(port,url,body,headers={}){return new Promise((resolve,reject)=>{const r=http.request({hostname:'127.0.0.1',port,path:url,method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...headers}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,data}));});r.on('error',reject);r.end(body===undefined?undefined:JSON.stringify(body));});}
test('SSE sends full snapshot on every connection',async t=>{const {port}=await setup(t);for(let i=0;i<2;i++)await new Promise((resolve,reject)=>{const r=http.get(`http://127.0.0.1:${port}/api/events`,res=>{let s='';res.on('data',c=>{s+=c;if(s.includes('event: pos')){const events=s.split('\n\n').filter(x=>x.startsWith('event:'));a.match(events[0],/event: set/);a.equal(JSON.parse(events[0].split('data: ')[1]).songs.length,4);a.match(events[1],/event: mix/);a.match(events[2],/event: play/);a.match(events[3],/"bar":11/);r.destroy();resolve();}});});r.on('error',reject);});});
test('fire validates current row and name',async t=>{const {port,bridge}=await setup(t);a.equal((await req(port,'/api/fire',{sceneIndex:23,name:'[N32] AA'})).status,204);for(const body of [{sceneIndex:23,name:'stale'},{sceneIndex:19,name:'* RISE >>'}])a.equal((await req(port,'/api/fire',body)).status,409);for(const body of [{sceneIndex:'23',name:'x'},null,{}])a.equal((await req(port,'/api/fire',body)).status,400);a.deepEqual(bridge.fires,[[23,'[N32] AA']]);});
test('stale snapshot after rename rejects launch',async t=>{const {port,bridge}=await setup(t);bridge.emit('scenes',fixture.map(s=>s.index===23?{...s,name:'RENAMED'}:s));a.equal((await req(port,'/api/fire',{sceneIndex:23,name:'[N32] AA'})).status,409);a.equal(bridge.fires.length,0);});
test('nonloopback auth and loopback-only settings',async t=>{const {port}=await setup(t,'192.168.1.20');const r=await req(port,'/');a.equal(r.status,401);a.match(r.headers['www-authenticate'],/Basic/);const headers={Authorization:'Basic '+Buffer.from('band:pw').toString('base64')};a.equal((await req(port,'/',undefined,headers)).status,200);a.equal((await req(port,'/api/config',undefined,headers)).status,403);a.equal((await req(port,'/api/config',{port:8765,username:'band',password:'x'},headers)).status,403);});
test('empty password forbids nonloopback',async t=>{const {port,app}=await setup(t,'100.64.0.9');await app.close();const bridge=new EventEmitter();const other=createApp({bridge,config:{port:8765,username:'band',password:''},remoteAddressOf:()=> '100.64.0.9'});const p=await other.listen(0);t.after(()=>other.close());a.equal((await req(p,'/')).status,403);});
test('static files, traversal, missing and unknown APIs',async t=>{const {port}=await setup(t);a.equal((await req(port,'/')).status,200);for(const url of ['/../package.json','/%2e%2e/package.json','/%ZZ','/api/missing'])a.equal((await req(port,url)).status,404);});
test('settings validate and save',async t=>{const {port,saved,app}=await setup(t);a.equal((await req(port,'/api/config',{port:0,username:'band',password:'x'})).status,400);a.equal((await req(port,'/api/config',{port:8765,username:'band',password:'x'})).status,200);a.equal(saved[0].password,'x');a.equal(app.getConfig().password,'x');});
test('rebound loopback Host requires auth and never grants settings',async t=>{
 const {port,bridge}=await setup(t);
 const bad={Host:'attacker.example:'+port,Origin:'http://attacker.example:'+port};
 for(const [url,body] of [['/',undefined],['/api/config',undefined],['/api/config',{port:8765,username:'band',password:'stolen'}],['/api/fire',{sceneIndex:23,name:'[N32] AA'}]])a.equal((await req(port,url,body,bad)).status,401);
 const authed={...bad,Authorization:'Basic '+Buffer.from('band:pw').toString('base64')};
 a.equal((await req(port,'/',undefined,authed)).status,200);
 a.equal((await req(port,'/api/config',undefined,authed)).status,403);
 a.equal((await req(port,'/api/config',{port:8765,username:'band',password:'x'},authed)).status,403);
 a.deepEqual(bridge.fires,[]);
});
test('settings responses hide passwords and an empty field preserves the password',async t=>{
 const {port,saved,app}=await setup(t);
 a.deepEqual(JSON.parse((await req(port,'/api/config')).data),{port:8765,username:'band',hasPassword:true});
 const result=await req(port,'/api/config',{port:8765,username:'new-band',password:''});
 a.deepEqual(JSON.parse(result.data),{port:8765,username:'new-band',hasPassword:true});
 a.equal(saved[0].password,'pw');a.equal(app.getConfig().password,'pw');
});
function stream(port) {
 const events=[];let resolveResponse;
 const ready=new Promise(resolve=>resolveResponse=resolve);
 const request=http.get(`http://127.0.0.1:${port}/api/events`,res=>{
  let buffer='';res.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n\n'))>=0){const message=buffer.slice(0,end);buffer=buffer.slice(end+2);if(message.startsWith('event:'))events.push(message);}});resolveResponse();
 });
 return {events,request,ready};
}
test('SSE waits for Live scenes and suppresses identical sets but sends changes',async t=>{
 const {port,bridge}=await setup(t,undefined,false),s=stream(port);t.after(()=>s.request.destroy());await s.ready;
 // A normal HTTP round trip lets any queued SSE writes drain; no polling needed.
 await req(port,'/');a.equal(s.events.filter(e=>e.startsWith('event: set')).length,0);
 bridge.emit('scenes',fixture);await req(port,'/');a.equal(s.events.filter(e=>e.startsWith('event: set')).length,1);
 bridge.emit('scenes',JSON.parse(JSON.stringify(fixture)));await req(port,'/');a.equal(s.events.filter(e=>e.startsWith('event: set')).length,1);
 bridge.emit('scenes',fixture.map(r=>r.index===23?{...r,loopBeats:64}:r));await req(port,'/');a.equal(s.events.filter(e=>e.startsWith('event: set')).length,2);
});
test('cross-origin mutation rejected',async t=>{const {port,bridge}=await setup(t);a.equal((await req(port,'/api/fire',{sceneIndex:23,name:'[N32] AA'},{Origin:'http://evil.example'})).status,403);a.deepEqual(bridge.fires,[]);});
test('port change relistens and occupied port preserves config',async t=>{
 const {port,app,saved}=await setup(t);
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'0.0.0.0',r));const next=probe.address().port;await new Promise(r=>probe.close(r));
 a.equal((await req(port,'/api/config',{port:next,username:'band',password:'pw'})).status,200);
 a.equal((await req(next,'/')).status,200);a.equal(app.getConfig().port,next);
 const occupied=http.createServer();await new Promise(r=>occupied.listen(0,'0.0.0.0',r));t.after(()=>new Promise(r=>occupied.close(r)));
 a.equal((await req(next,'/api/config',{port:occupied.address().port,username:'band',password:'pw'})).status,400);
 a.equal(app.getConfig().port,next);a.equal(saved.length,1);
});

const mixFixture=require('../device/lib/fixture-mix.json');
const sendBody=value=>({trackIndex:0,returnIndex:2,rawName:'+ DRUMS',returnName:'Shaun',value});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('send validates names, return routing and numeric range',async t=>{
 const {port,bridge}=await setup(t);const calls=[];bridge.setSend=(...args)=>calls.push(args);bridge.emit('mix',mixFixture);
 a.equal((await req(port,'/api/send',sendBody(0.6))).status,204);
 a.deepEqual(calls,[[0,2,0.6]]);
 for(const body of [{...sendBody(0.5),rawName:'stale'}, {...sendBody(0.5),returnName:'stale'}, {...sendBody(0.5),returnIndex:0,returnName:'A-Verb'}])a.equal((await req(port,'/api/send',body)).status,409);
 for(const value of [1.5,-0.1,NaN,'0.5',null])a.equal((await req(port,'/api/send',sendBody(value))).status,400);
});
test('send coalesces a burst and retains the final value',async t=>{
 const {port,bridge}=await setup(t);const calls=[];bridge.setSend=(...args)=>calls.push(args);bridge.emit('mix',mixFixture);
 const results=await Promise.all(Array.from({length:10},(_,i)=>req(port,'/api/send',sendBody(i/10))));
 a.ok(results.every(r=>r.status===204));await wait(45);
 a.ok(calls.length<=2);a.equal(calls[calls.length-1][2],0.9);
});
test('queued sends are discarded when a target changes',async t=>{
 const {port,bridge}=await setup(t);const calls=[];bridge.setSend=(...args)=>calls.push(args);bridge.emit('mix',mixFixture);
 await req(port,'/api/send',sendBody(0.6));await req(port,'/api/send',sendBody(0.7));
 bridge.emit('mix',{...mixFixture,tracks:mixFixture.tracks.map(t=>t.index===0?{...t,name:'+ Renamed'}:t)});
 await wait(45);a.deepEqual(calls,[[0,2,0.6]]);
});
test('SSE sends mix on connect and level changes persist for later clients',async t=>{
 const {port,bridge}=await setup(t);bridge.emit('mix',mixFixture);
 const s=stream(port);t.after(()=>s.request.destroy());await s.ready;await req(port,'/');
 const initial=JSON.parse(s.events.find(e=>e.startsWith('event: mix')).split('data: ')[1]);a.equal(initial.returns.length,3);
 bridge.emit('level',{trackIndex:0,returnIndex:2,value:0.88,label:'-1.1 dB'});await req(port,'/');
 a.ok(s.events.some(e=>e.startsWith('event: level')&&e.includes('0.88')));
 const later=stream(port);t.after(()=>later.request.destroy());await later.ready;await req(port,'/');
 const current=JSON.parse(later.events.find(e=>e.startsWith('event: mix')).split('data: ')[1]);
 a.deepEqual(current.strips[0].levels[2],{value:0.88,label:'-1.1 dB'});
});
test('fake mix echoes sends and subsequent snapshots retain them',()=>{
 const {createFakeBridge}=require('../device/lib/fake-bridge');const bridge=createFakeBridge([],mixFixture);let level,raw;
 bridge.on('level',v=>level=v);bridge.on('mix',v=>raw=v);bridge.setSend(0,2,0);bridge.snapshot();
 a.equal(level.label,'-inf dB');a.equal(raw.tracks[0].sends[2].value,0);a.notEqual(mixFixture.tracks[0].sends[2].value,0);
});

test('send requires nonloopback credentials and rejects cross-origin writes even with auth',async t=>{
 const {port,bridge}=await setup(t,'192.168.1.20');const calls=[];bridge.setSend=(...args)=>calls.push(args);bridge.emit('mix',mixFixture);
 const challenge=await req(port,'/api/send',sendBody(0.6));a.equal(challenge.status,401);a.match(challenge.headers['www-authenticate'],/Basic/);a.deepEqual(calls,[]);
 const auth={Authorization:'Basic '+Buffer.from('band:pw').toString('base64')};
 a.equal((await req(port,'/api/send',sendBody(0.6),{...auth,Origin:'http://evil.example'})).status,403);a.deepEqual(calls,[]);
 a.equal((await req(port,'/api/send',sendBody(0.6),auth)).status,204);a.deepEqual(calls,[[0,2,0.6]]);
});
test('send forbids nonloopback access when no password is configured',async t=>{
 const {port,bridge}=await setup(t,'100.64.0.9',true,'');const calls=[];bridge.setSend=(...args)=>calls.push(args);bridge.emit('mix',mixFixture);
 a.equal((await req(port,'/api/send',sendBody(0.6))).status,403);a.deepEqual(calls,[]);
});
test('send challenges a bad Host on loopback rather than bypassing authentication',async t=>{
 const {port,bridge}=await setup(t);const calls=[];bridge.setSend=(...args)=>calls.push(args);bridge.emit('mix',mixFixture);
 const response=await req(port,'/api/send',sendBody(0.6),{Host:'attacker.example:'+port});
 a.equal(response.status,401);a.match(response.headers['www-authenticate'],/Basic/);a.deepEqual(calls,[]);
});

const transportState={is_playing:1,record_mode:0,tempo:120,current_song_time:3.5,signature_numerator:6,signature_denominator:8};
test('transport validates all commands and bridges explicit record targets',async t=>{
 const {port,bridge}=await setup(t);const calls=[];bridge.transport=(...args)=>calls.push(args);
 for(const body of [null,{},[],{command:'toggle'},{command:'record'},{command:'record',value:'1'},{command:'record',value:2},{command:'play',value:1}])a.equal((await req(port,'/api/transport',body)).status,400);
 for(const body of [{command:'play'},{command:'stop'},{command:'record',value:1},{command:'record',value:1},{command:'record',value:0}])a.equal((await req(port,'/api/transport',body)).status,204);
 a.deepEqual(calls,[['play',undefined],['stop',undefined],['record',1],['record',1],['record',0]]);
});
test('transport snapshot waits for Live, replays latest state on connect and coalesces updates',async t=>{
 const {port,bridge}=await setup(t);const s=stream(port);t.after(()=>s.request.destroy());await s.ready;await req(port,'/');
 a.equal(s.events.filter(e=>e.startsWith('event: transport')).length,0);
 bridge.emit('transport',transportState);await req(port,'/');
 const initial=JSON.parse(s.events.find(e=>e.startsWith('event: transport')).split('data: ')[1]);a.equal(initial.position,'2.2');
 for(let i=0;i<20;i++)bridge.emit('transport',{...transportState,current_song_time:i});
 const later=stream(port);t.after(()=>later.request.destroy());await later.ready;await req(port,'/');
 a.equal(JSON.parse(later.events.find(e=>e.startsWith('event: transport')).split('data: ')[1]).current_song_time,19);
 await wait(120);const updates=s.events.filter(e=>e.startsWith('event: transport'));a.equal(updates.length,2);
 a.equal(JSON.parse(updates[1].split('data: ')[1]).current_song_time,19);
 bridge.emit('transport',{});await req(port,'/');a.equal(s.events.filter(e=>e.startsWith('event: transport')).length,2);
});
test('transport requires auth and rejects cross-origin and rebound-host mutations',async t=>{
 const {port,bridge}=await setup(t,'192.168.1.20');const calls=[];bridge.transport=(...args)=>calls.push(args);
 const body={command:'stop'},auth={Authorization:'Basic '+Buffer.from('band:pw').toString('base64')};
 a.equal((await req(port,'/api/transport',body)).status,401);
 a.equal((await req(port,'/api/transport',body,{...auth,Origin:'http://evil.example'})).status,403);
 a.deepEqual(calls,[]);a.equal((await req(port,'/api/transport',body,auth)).status,204);
 const local=await setup(t);a.equal((await req(local.port,'/api/transport',body,{Host:'attacker.example'})).status,401);
 const empty=await setup(t,'100.64.0.9',true,'');a.equal((await req(empty.port,'/api/transport',body)).status,403);
});

test('index progress streams to existing clients and reconnect snapshots until completion',async t=>{
 const {port,bridge}=await setup(t,undefined,false),s=stream(port);t.after(()=>s.request.destroy());await s.ready;
 bridge.emit('progress',{done:0,total:1000});bridge.emit('progress',{done:340,total:1000});await req(port,'/');
 const values=s.events.filter(e=>e.startsWith('event: progress')).map(e=>JSON.parse(e.split('data: ')[1]));
 a.deepEqual(values,[{done:0,total:1000},{done:340,total:1000}]);
 const later=stream(port);t.after(()=>later.request.destroy());await later.ready;await req(port,'/');
 a.deepEqual(JSON.parse(later.events.find(e=>e.startsWith('event: progress')).split('data: ')[1]),{done:340,total:1000});
 a.equal(later.events.some(e=>e.startsWith('event: set')),false);
 bridge.emit('scenes',fixture);bridge.emit('progress',{done:1000,total:1000});await req(port,'/');
 a.ok(later.events.findIndex(e=>e.startsWith('event: set'))<later.events.findIndex(e=>e.startsWith('event: progress')&&e.includes('"done":1000')));
 const count=s.events.length;
 for(const value of [null,{}, {done:-1,total:1000},{done:1001,total:1000},{done:1.5,total:10}])bridge.emit('progress',value);
 await req(port,'/');a.equal(s.events.length,count);
 const complete=stream(port);t.after(()=>complete.request.destroy());await complete.ready;await req(port,'/');
 a.deepEqual(JSON.parse(complete.events.find(e=>e.startsWith('event: progress')).split('data: ')[1]),{done:1000,total:1000});
 s.request.destroy();later.request.destroy();complete.request.destroy();
});

test('slow fake index publishes progress before a single complete scene snapshot',()=>{
 const intervals=[],cleared=[];
 const source=require('fs').readFileSync(path.join(__dirname,'../device/lib/fake-bridge.js'),'utf8');
 const module={exports:{}};
 require('vm').runInNewContext(source,{module,require,setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval:id=>cleared.push(id),setTimeout,clearTimeout});
 const bridge=module.exports.createFakeBridge(fixture,undefined,{slowIndex:true}),events=[];
 bridge.on('scenes',rows=>events.push(['scenes',rows.length]));bridge.on('progress',p=>events.push(['progress',p.done,p.total]));
 bridge.snapshot();a.deepEqual(events,[['progress',0,fixture.length]]);
 for(let n=0;n<fixture.length;n++)intervals[0]();
 a.deepEqual(events.at(-2),['scenes',fixture.length]);a.deepEqual(events.at(-1),['progress',fixture.length,fixture.length]);a.deepEqual(cleared,[1]);
});

test('play carries current/next scene details for pre-title, title and normal scenes and connect snapshots',async t=>{
 const {port,bridge}=await setup(t);
 const scenes=[{index:0,name:'Count in',color:1,loopBeats:16,beatsPerBar:4},
  {index:1,name:'* Song',color:2,loopBeats:null,beatsPerBar:4},
  {index:2,name:'Verse',color:3,loopBeats:32,beatsPerBar:4}];
 bridge.emit('scenes',scenes);
 const s=stream(port);t.after(()=>s.request.destroy());await s.ready;await req(port,'/');
 const plays=()=>s.events.filter(e=>e.startsWith('event: play')).map(e=>JSON.parse(e.split('data: ')[1]));
 const details=({index,...scene})=>scene;
 for (const [playing,fired] of [[0,1],[1,2],[2,0],[2,2]]) {
  bridge.emit('play',{playing,fired});await req(port,'/');
  const p=plays().at(-1);a.equal(p.playing,playing);a.equal(p.fired,fired);
  a.deepEqual(p.current,details(scenes[playing]));a.deepEqual(p.next,details(scenes[fired]));
  a.equal(p.playingSongId,playing===2?1:null);
 }
 // A rename outside parsed rows must still refresh play while set stays unchanged.
 bridge.emit('play',{playing:0,fired:1});await req(port,'/');
 const setCount=s.events.filter(e=>e.startsWith('event: set')).length;
 const renamed=scenes.map(scene=>scene.index===0?{...scene,name:'New count in',color:9}:scene);
 bridge.emit('scenes',renamed);await req(port,'/');
 a.equal(s.events.filter(e=>e.startsWith('event: set')).length,setCount);
 a.deepEqual(plays().at(-1).current,details(renamed[0]));
 a.deepEqual(plays().at(-1).next,details(scenes[1]));
 const retitled=renamed.map(scene=>scene.index===1?{...scene,name:'* New song',color:10}:scene);
 bridge.emit('scenes',retitled);await req(port,'/');
 a.deepEqual(plays().at(-1).next,details(retitled[1]));
 bridge.emit('play',{playing:1,fired:2});
 const moved=retitled.map(scene=>scene.index===1?{...scene,name:'* Final song'}:scene);
 bridge.emit('scenes',moved);await req(port,'/');
 a.deepEqual(plays().at(-1).current,details(moved[1]));
 const later=stream(port);t.after(()=>later.request.destroy());await later.ready;await req(port,'/');
 a.deepEqual(JSON.parse(later.events.find(e=>e.startsWith('event: play')).split('data: ')[1]),plays().at(-1));
 bridge.emit('play',{playing:-1,fired:-1});await req(port,'/');
 a.deepEqual(plays().at(-1),{playing:-1,fired:-1,playingSongId:null,current:null,next:null});
 bridge.emit('play',{playing:0,fired:1});bridge.emit('scenes',[]);await req(port,'/');
 a.equal(plays().at(-1).current,null);a.equal(plays().at(-1).next,null);
});

for (const order of ['production', 'fixture']) test(`Monitor suppresses stale scene names through re-index and recovers with ${order} event order`,async t=>{
 const {port,bridge}=await setup(t);
 const scenes=['* Song','Intro','Verse','Chorus','Outro'].map((name,index)=>({index,name,color:index+1,loopBeats:16,beatsPerBar:4}));
 bridge.emit('scenes',scenes);bridge.emit('play',{playing:2,fired:3});
 const s=stream(port);t.after(()=>s.request.destroy());await s.ready;await req(port,'/');
 const latest=client=>JSON.parse(client.events.filter(e=>e.startsWith('event: play')).at(-1).split('data: ')[1]);
 a.equal(latest(s).current.name,'Verse');a.equal(latest(s).next.name,'Chorus');
 bridge.emit('progress',{done:0,total:6});await req(port,'/');
 // Invalidate already-published metadata immediately, before Live's next play.
 a.equal(latest(s).current,null);a.equal(latest(s).next,null);
 bridge.emit('play',{playing:3,fired:4});
 bridge.emit('pos',{scene:3,position:4,loopStart:0,loopEnd:16,beatsPerBar:4});await req(port,'/');
 // These new indexes point at Chorus/Outro in the old map; never publish them.
 a.equal(latest(s).playing,3);a.equal(latest(s).fired,4);
 a.equal(latest(s).current,null);a.equal(latest(s).next,null);
 const mid=stream(port);t.after(()=>mid.request.destroy());await mid.ready;await req(port,'/');
 a.equal(latest(mid).current,null);a.equal(latest(mid).next,null);
 const shifted=[{index:0,name:'Count in',color:99,loopBeats:4,beatsPerBar:4},...scenes.map(scene=>({...scene,index:scene.index+1}))];
 bridge.emit('scenes',shifted);
 // Production follows completion with play; fixture sends play before completion.
 if(order==='fixture')bridge.emit('play',{playing:3,fired:4});
 await req(port,'/');a.equal(latest(s).current,null);a.equal(latest(mid).next,null);
 bridge.emit('progress',{done:6,total:6});await req(port,'/');
 // Completion must restore both clients without requiring another play event.
 for(const client of [s,mid]){
  a.deepEqual(latest(client).current,{name:'Verse',color:3,loopBeats:16,beatsPerBar:4});
  a.deepEqual(latest(client).next,{name:'Chorus',color:4,loopBeats:16,beatsPerBar:4});
 }
 if(order==='production')bridge.emit('play',{playing:3,fired:4});
 await req(port,'/');a.equal(latest(s).current.name,'Verse');
});

test('connect snapshot sends stopped transport before a retained playing scene',async t=>{
 const {port,bridge}=await setup(t);
 bridge.emit('transport',{...transportState,is_playing:0});
 const s=stream(port);t.after(()=>s.request.destroy());await s.ready;await req(port,'/');
 const transportIndex=s.events.findIndex(e=>e.startsWith('event: transport'));
 const playIndex=s.events.findIndex(e=>e.startsWith('event: play'));
 a.ok(transportIndex>=0 && transportIndex<playIndex);
 a.equal(JSON.parse(s.events[transportIndex].split('data: ')[1]).is_playing,0);
 a.equal(JSON.parse(s.events[playIndex].split('data: ')[1]).playing,23);
});

const basic={Authorization:'Basic '+Buffer.from('band:pw').toString('base64')};
async function accessSetup(t,extra={}) {
 const bridge=new EventEmitter(), saved=[],calls=[];bridge.fire=(...args)=>calls.push(args);bridge.transport=(...args)=>calls.push(args);bridge.setSend=(...args)=>calls.push(args);
 const app=createApp({bridge,config:{port:8765,username:'band',password:'pw',accessEnabled:true,members:[{id:'alex',name:'Alex',pages:['monitor'],mixes:['Shaun']}],adminPassword:'boss',...extra},saveConfig:c=>saved.push(c),remoteAddressOf:req=>req.headers['x-test-phone']?'192.168.1.3':'127.0.0.1'});
 const port=await app.listen(0);bridge.emit('mix',mixFixture);bridge.emit('scenes',fixture);t.after(()=>app.close());
 return {port,bridge,app,saved,calls,phone:{...basic,'x-test-phone':'1'}};
}
const cookieOf=r=>r.headers['set-cookie'][0].split(';')[0];
test('access routes enforce admin, basic auth, origin and identity; laptop recovers corrupt cookies',async t=>{
 const {port,phone}=await accessSetup(t);
 a.equal((await req(port,'/api/me',undefined,{'x-test-phone':'1'})).status,401);
 a.equal(JSON.parse((await req(port,'/api/me',undefined,{...phone,Cookie:'st_id=forged'})).data).kind,'none');
 for(const route of ['/api/members','/api/config'])a.equal((await req(port,route,undefined,phone)).status,403);
 a.equal((await req(port,'/api/members',{members:[]},phone)).status,403);
 a.equal((await req(port,'/api/identify',{memberId:'missing'},phone)).status,404);
 a.equal((await req(port,'/api/identify',{memberId:'alex'},{...phone,Origin:'http://evil'})).status,403);
 const chosen=await req(port,'/api/identify',{memberId:'alex'},phone);a.equal(chosen.status,204);a.match(chosen.headers['set-cookie'][0],/HttpOnly; SameSite=Strict; Path=\/; Max-Age=31536000/);
 const player={...phone,Cookie:cookieOf(chosen)};
 a.equal(JSON.parse((await req(port,'/api/me',undefined,player)).data).name,'Alex');
 for(const route of ['/api/fire','/api/transport','/api/members'])a.equal((await req(port,route,{},player)).status,403);
 a.equal((await req(port,'/api/send',{...sendBody(0.5),returnIndex:3,returnName:'Shaun'},player)).status,403);
 a.equal((await req(port,'/api/members',undefined,player)).status,403);
 a.equal((await req(port,'/api/admin-login',{password:'bad'},phone)).status,403);
 a.equal((await req(port,'/api/admin-login',{password:'boss'},phone)).status,429);
 a.equal(JSON.parse((await req(port,'/api/me',undefined,{Cookie:'st_id=broken'})).data).kind,'admin');
 a.equal((await req(port,'/api/forget',{},player)).status,204);
});
test('phone admin works before access enabled; only laptop may disable access; settings preserve all access fields',async t=>{
 const {port,phone,app,saved}=await accessSetup(t,{accessEnabled:false});
 a.equal((await req(port,'/api/members',undefined,phone)).status,403);
 const login=await req(port,'/api/admin-login',{password:'boss'},phone);a.equal(login.status,204);
 const admin={...phone,Cookie:cookieOf(login)};
 a.equal((await req(port,'/api/members',undefined,admin)).status,200);
 // Enable restrictions from laptop.
 a.equal((await req(port,'/api/config',{port:8765,username:'band',password:'',accessEnabled:true})).status,200);
 a.equal((await req(port,'/api/members',undefined,admin)).status,200);
 a.equal((await req(port,'/api/config',{},admin)).status,403);
 const before=app.getConfig();
 a.equal((await req(port,'/api/config',{port:8765,username:'new',password:'',adminPassword:''})).status,200);
 const after=app.getConfig();for(const k of ['members','secret','adminPassword','accessEnabled','password'])a.deepEqual(after[k],before[k]);
 a.equal(saved.at(-1).secret,before.secret);
 a.equal((await req(port,'/api/config',{port:8765,username:'new',password:'',accessEnabled:false})).status,200);
});
test('members mutations broadcast access, preserve ids, revoke cookies and flag orphaned return permissions',async t=>{
 const {port,phone}=await accessSetup(t),s=stream(port);t.after(()=>s.request.destroy());await s.ready;
 const cookie=cookieOf(await req(port,'/api/identify',{memberId:'alex'},phone));
 const members=[{id:'alex',name:'Renamed',pages:['scenes','transport'],mixes:['Missing']}];
 a.equal((await req(port,'/api/members',{members})).status,200);await req(port,'/');a.ok(s.events.some(e=>e.startsWith('event: access')));
 const me=JSON.parse((await req(port,'/api/me',undefined,{...phone,Cookie:cookie})).data);a.equal(me.name,'Renamed');a.deepEqual(me.pages,['scenes','transport']);
 a.deepEqual(JSON.parse((await req(port,'/api/members')).data)[0].orphanMixes,['Missing']);
 a.equal((await req(port,'/api/members',{members:[{name:'Shaun'}]})).status,200);
 const fresh=JSON.parse((await req(port,'/api/members')).data)[0];a.ok(fresh.id);a.deepEqual(fresh.pages,['monitor']);a.deepEqual(fresh.mixes,['Shaun']);
 a.equal((await req(port,'/api/members',{members:[{id:'bad'}]})).status,400);
 a.equal((await req(port,'/api/members',{members:[]})).status,200);
 const removed=JSON.parse((await req(port,'/api/me',undefined,{...phone,Cookie:cookie})).data);a.equal(removed.kind,'none');a.equal(removed.accessEnabled,true);
});
test('send uses authoritative return index, fails closed after rename and revokes pending sends',async t=>{
 const {port,phone,bridge,calls}=await accessSetup(t);
 const player={...phone,Cookie:cookieOf(await req(port,'/api/identify',{memberId:'alex'},phone))};
 a.equal((await req(port,'/api/send',{...sendBody(0.4),returnIndex:3,returnName:'Shaun'},player)).status,403);
 a.equal((await req(port,'/api/send',sendBody(0.4),player)).status,204);
 a.equal((await req(port,'/api/send',sendBody(0.5),player)).status,204);
 await req(port,'/api/members',{members:[]});await wait(45);a.deepEqual(calls,[[0,2,0.4]]);
 await req(port,'/api/members',{members:[{id:'alex',name:'Alex',pages:['monitor'],mixes:['Shaun']}]});
 bridge.emit('mix',{...mixFixture,returns:mixFixture.returns.map(r=>r.index===2?{...r,name:'Renamed'}:r)});
 a.equal((await req(port,'/api/send',sendBody(0.7),player)).status,403);
});
test('coalesced sends retain the identity of the latest sender',async t=>{
 const {port,phone,calls}=await accessSetup(t);
 await req(port,'/api/members',{members:['alex','second'].map(id=>({id,name:id,pages:['monitor'],mixes:['Shaun']}))});
 const player=async id=>({...phone,Cookie:cookieOf(await req(port,'/api/identify',{memberId:id},phone))});
 const first=await player('alex'),second=await player('second');
 await req(port,'/api/send',sendBody(0.2),first);await req(port,'/api/send',sendBody(0.3),first);await req(port,'/api/send',sendBody(0.8),second);
 await req(port,'/api/members',{members:[{id:'second',name:'second',pages:['monitor'],mixes:['Shaun']}]});
 await wait(45);a.equal(calls.at(-1)[2],0.8);
});

test('password rotation revokes an already signed-in phone admin at both read endpoints',async t=>{
 const {port,phone}=await accessSetup(t);const admin={...phone,Cookie:cookieOf(await req(port,'/api/admin-login',{password:'boss'},phone))};
 a.equal((await req(port,'/api/members',undefined,admin)).status,200);
 await req(port,'/api/config',{port:8765,username:'band',password:'',adminPassword:'replacement'});
 a.equal(JSON.parse((await req(port,'/api/me',undefined,admin)).data).kind,'none');a.equal((await req(port,'/api/members',undefined,admin)).status,403);
});
test('saving members after laptop disables access does not re-enable restrictions',async t=>{
 const {port,phone}=await accessSetup(t);const admin={...phone,Cookie:cookieOf(await req(port,'/api/admin-login',{password:'boss'},phone))};
 const members=JSON.parse((await req(port,'/api/members')).data);
 await req(port,'/api/config',{port:8765,username:'band',password:'',accessEnabled:false});
 a.equal((await req(port,'/api/members',{members},admin)).status,200);
 a.equal(JSON.parse((await req(port,'/api/me',undefined,phone)).data).kind,'open');
});
test('send refuses anonymous malformed JSON before parsing but returns a stale mix to eligible members',async t=>{
 const {port,phone}=await accessSetup(t);
 const malformedStatus=await new Promise((resolve,reject)=>{
  const request=http.request({hostname:'127.0.0.1',port,path:'/api/send',method:'POST',headers:{...phone,'Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
  request.on('error',reject);request.end('{');
 });a.equal(malformedStatus,403);
 const player={...phone,Cookie:cookieOf(await req(port,'/api/identify',{memberId:'alex'},phone))};
 const stale=await req(port,'/api/send',{...sendBody(0.5),returnIndex:999},player);a.equal(stale.status,409);a.ok(JSON.parse(stale.data).mix);
 a.equal((await req(port,'/api/send',{...sendBody(0.5),returnIndex:3,returnName:'Shaun'},player)).status,403);
});

test('laptop settings report damaged config and a password save retains its recovery copy',async t=>{
 const fs=require('fs'),os=require('os'),{loadConfig,saveConfig}=require('../device/lib/config');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'damaged-settings-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'config.json');
 const bytes='{"password":"keep-original","members":[';fs.writeFileSync(file,bytes);
 const config=loadConfig(file),app=createApp({bridge:new EventEmitter(),config,saveConfig:cfg=>saveConfig(cfg,file)});t.after(()=>app.close());const port=await app.listen(0);
 const before=JSON.parse((await req(port,'/api/config')).data);a.deepEqual(before.configWarning,{backupAvailable:true});
 a.equal((await req(port,'/api/config',{port:config.port,username:'band',password:'replacement'})).status,200);
 a.equal(fs.readFileSync(file+'.damaged','utf8'),bytes);a.equal(JSON.parse(fs.readFileSync(file)).accessEnabled,true);
 a.deepEqual(JSON.parse((await req(port,'/api/config')).data).configWarning,{backupAvailable:true});
});
