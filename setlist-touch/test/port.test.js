const {test}=require('node:test');
const a=require('node:assert/strict'),http=require('http'),fs=require('fs'),os=require('os'),path=require('path');
const {EventEmitter}=require('events');
const {createApp,probeLoopback}=require('../device/lib/app');
const {loadConfig,saveConfig}=require('../device/lib/config');
const config={port:8765,username:'band',password:'pw'};
async function server(t,handler=(req,res)=>res.end('another app')) {
 const s=http.createServer(handler);await new Promise(r=>s.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>s.close(r)));return s;
}
function appFor(t,options={}) {
 const app=createApp({bridge:new EventEmitter(),config,saveConfig:()=>{},...options});
 t.after(()=>app.close());return app;
}
function request(port,body) {
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port,path:'/api/config',method:body?'POST':'GET',agent:false,headers:body?{'Content-Type':'application/json'}:{}},res=>{
   let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,data}));
  });req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
 });
}
test('startup bind failure falls forward and persists the working port to disk',async t=>{
 const occupied=await server(t),port=occupied.address().port;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'setlist-port-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'config.json');saveConfig({...config,port},file);
 const app=appFor(t,{config:loadConfig(file),saveConfig:cfg=>saveConfig(cfg,file)});
 const next=await app.listenWithFallback(port);a.ok(next>port&&next<=port+19);
 a.equal(app.getConfig().port,next);a.equal(loadConfig(file).port,next);
 a.equal(app.getPortNote(),`Port ${port} was busy — now on ${next}`);
 const result=await request(next);a.equal(JSON.parse(result.data).portNote,app.getPortNote());
 const html=fs.readFileSync(path.join(__dirname,'../device/web/index.html'),'utf8');a.match(html,/settings-port-note/);
 a.match(fs.readFileSync(path.join(__dirname,'../device/web/js/app.js'),'utf8'),/portNote.textContent=cfg.portNote/);
});
test('nonce check rejects another HTTP 200 server and times out a hanging one',async t=>{
 const other=await server(t);a.equal(await probeLoopback(other.address().port,'expected-nonce'),false);
 const sockets=new Set(),hang=await server(t,()=>{});hang.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
 a.equal(await probeLoopback(hang.address().port,'expected-nonce'),false);for(const s of sockets)s.destroy();
});
test('a bound but shadowed port is discarded before falling forward (injected OS probe)',async t=>{
 let first,checks=0;const saved=[];
 const app=appFor(t,{probe:async(port,nonce)=>{checks++;if(!first){first=port;return false;}return probeLoopback(port,nonce);},saveConfig:cfg=>saved.push(cfg)});
 // Port zero is useful for an exact listen; use its released port for startup.
 const temp=await server(t);const port=temp.address().port;await new Promise(r=>temp.close(r));
 const next=await app.listenWithFallback(port);a.ok(next>first);a.ok(checks>=2);a.equal(saved[0].port,next);
 // The discarded wildcard listener no longer owns the first port.
 const replacement=http.createServer();await new Promise((resolve,reject)=>{replacement.once('error',reject);replacement.listen(first,'0.0.0.0',resolve);});await new Promise(r=>replacement.close(r));
});
test('bounded failure includes the range and never exceeds 65535',async t=>{
 const attempted=[],saved=[];const app=appFor(t,{probe:async port=>{attempted.push(port);return false;},saveConfig:cfg=>saved.push(cfg)});
 await a.rejects(app.listenWithFallback(65534),{message:'Ports 65534–65535 are busy. Close the other program or set "port" in config.json, then reload the device.'});
 a.ok(attempted.every(p=>p<=65535));a.equal(saved.length,0);a.equal(app.getConfig().port,8765);
});
test('startup tries at most 20 sequential ports',async t=>{
 const app=appFor(t,{probe:async()=>false});
 await a.rejects(app.listenWithFallback(32000),/Ports 32000–32019 are busy/);
});
test('damaged config is preserved byte for byte and fallback warns it is memory only',async t=>{
 const occupied=await server(t),port=occupied.address().port;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'setlist-damaged-port-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'config.json'),bytes='{broken user data';fs.writeFileSync(file,bytes);
 const cfg=loadConfig(file);let writes=0;
 const app=appFor(t,{config:cfg,saveConfig:value=>{writes++;saveConfig(value,file);}});
 const next=await app.listenWithFallback(port);a.ok(next>port);a.equal(writes,0);a.equal(fs.readFileSync(file,'utf8'),bytes);
 a.match(app.getPortNote(),/In memory only: damaged or unreadable/);
});
test('write failure keeps successful server running and reports memory-only fallback',async t=>{
 const busy=await server(t);const app=appFor(t,{saveConfig:()=>{throw Error('read only');}});
 const port=await app.listenWithFallback(busy.address().port);a.equal((await request(port)).status,200);a.match(app.getPortNote(),/In memory only: could not save/);
});
test('free configured port is checked and does not cause a startup save',async t=>{
 let writes=0,checks=0;const app=appFor(t,{saveConfig:()=>writes++,probe:(port,nonce)=>{checks++;return probeLoopback(port,nonce);}});
 const free=await server(t);const port=free.address().port;await new Promise(r=>free.close(r));
 a.equal(await app.listenWithFallback(port),port);a.equal(writes,0);a.equal(checks,1);a.equal(app.getPortNote(),'');
});
test('settings refuses a shadowed exact port without falling forward or saving',async t=>{
 const attempted=[],saved=[];let shadow=false;
 const app=appFor(t,{probe:(port,nonce)=>{attempted.push(port);return shadow?false:probeLoopback(port,nonce);},saveConfig:cfg=>saved.push(cfg)});
 const port=await app.listen(0);shadow=true;
 const free=await server(t);const target=free.address().port;await new Promise(r=>free.close(r));
 const result=await request(port,{...config,port:target});a.equal(result.status,400);a.match(result.data,/is busy/);
 a.deepEqual(attempted,[port,target]);a.equal(saved.length,0);a.equal(app.getConfig().port,8765);a.equal((await request(port)).status,200);
});

test('unreadable config fallback never invokes persistence',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'setlist-unreadable-port-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 // Reading a directory fails even when the test user can bypass permission bits.
 const cfg=loadConfig(dir);a.ok(cfg.configWarning);let writes=0;
 const busy=await server(t),app=appFor(t,{config:cfg,saveConfig:()=>writes++});
 await app.listenWithFallback(busy.address().port);a.equal(writes,0);a.ok(fs.statSync(dir).isDirectory());a.match(app.getPortNote(),/In memory only/);
});
