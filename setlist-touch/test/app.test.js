const {test}=require('node:test');const a=require('node:assert/strict');
const http=require('http'),path=require('path');const {EventEmitter}=require('events');
const {createApp}=require('../device/lib/app');const fixture=require('../device/lib/fixture-rise.json');
async function setup(t,remoteAddress,ready=true){const bridge=new EventEmitter();bridge.fires=[];bridge.fire=(i,name)=>bridge.fires.push([i,name]);const saved=[];const app=createApp({bridge,config:{port:8765,username:'band',password:'pw'},saveConfig:c=>saved.push(c),webRoot:path.join(__dirname,'../device/web'),remoteAddressOf:remoteAddress?()=>remoteAddress:undefined});const port=await app.listen(0);if(ready)bridge.emit('scenes',fixture);bridge.emit('play',{playing:23,fired:-1});bridge.emit('pos',{scene:23,position:42,loopStart:0,loopEnd:128,beatsPerBar:4});t.after(()=>app.close());return {bridge,app,port,saved};}
function req(port,url,body,headers={}){return new Promise((resolve,reject)=>{const r=http.request({hostname:'127.0.0.1',port,path:url,method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...headers}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,data}));});r.on('error',reject);r.end(body===undefined?undefined:JSON.stringify(body));});}
test('SSE sends full snapshot on every connection',async t=>{const {port}=await setup(t);for(let i=0;i<2;i++)await new Promise((resolve,reject)=>{const r=http.get(`http://127.0.0.1:${port}/api/events`,res=>{let s='';res.on('data',c=>{s+=c;if(s.includes('event: pos')){const events=s.split('\n\n').filter(x=>x.startsWith('event:'));a.match(events[0],/event: set/);a.equal(JSON.parse(events[0].split('data: ')[1]).songs.length,4);a.match(events[1],/event: play/);a.match(events[2],/"bar":11/);r.destroy();resolve();}});});r.on('error',reject);});});
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
