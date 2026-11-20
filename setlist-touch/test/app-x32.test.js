'use strict';
const {test} = require('node:test');
const a = require('node:assert/strict');
const http = require('http');
const {EventEmitter} = require('events');
const {createApp} = require('../device/lib/app');
const {normalizeAccess,sign,memberToken,validMembers} = require('../device/lib/access');
const {loadConfig} = require('../device/lib/config');
const fs = require('fs'), os = require('os'), path = require('path');
const sleep = ms => new Promise(r => setTimeout(r,ms));
async function setup(t, options = {}) {
  const members = [{id:'a',name:'Alice',pages:[],mixes:[],buses:[6],hidden:{}},{id:'b',name:'Bob',pages:[],mixes:[],buses:[7],hidden:{}}];
  const config = normalizeAccess({port:8765,username:'band',password:'',allowOpenLan:true,accessEnabled:true,members,...options});
  const x32 = new EventEmitter(); let state = 'connected';
  const snapshot = {sources:[{id:'ch/01',kind:'ch',number:1,name:'Vox',color:1},{id:'ch/02',kind:'ch',number:2,name:'',color:0}],buses:[5,7].map(bus => ({bus,name:'',linked:bus===5,toMain:bus===5,master:0.5,sends:{'ch/01':0.4,'ch/02':0}}))};
  x32.status = () => ({state,host:'192.168.1.32',name:'Fake',model:'X32'});
  x32.snapshot = () => state === 'connected' ? structuredClone(snapshot) : null;
  x32.busFor = n => n === 6 ? 5 : n;
  const writes = []; x32.setSend = (...args) => {writes.push(args);return true;}; x32.setBusMaster = (bus,v) => {writes.push([bus,'master',v]);return true;}; x32.setHost = host => {x32.host=host;};
  const app = createApp({bridge:new EventEmitter(),config,x32,saveConfig:async()=>{},remoteAddressOf:()=> '192.168.1.9'});
  const port = await app.listen(0); t.after(()=>app.close());
  const cookies = Object.fromEntries(config.members.map(m => [m.id,'st_id='+sign(memberToken(m),config.secret)]));
  const admin = 'st_id='+sign(require('../device/lib/access').adminToken({...config,adminPassword:'pw'}),config.secret);
  function req(url, value, who='a', method=value===undefined?'GET':'POST') {
    return new Promise((resolve,reject) => {
      const r=http.request({hostname:'127.0.0.1',port,path:url,method,headers:{'Content-Type':'application/json',Cookie:who==='admin'?admin:cookies[who] || ''}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,data,json:()=>JSON.parse(data)}));});r.on('error',reject);r.end(value===undefined?undefined:JSON.stringify(value));
    });
  }
  return {app,x32,req,port,snapshot,writes,drop:()=>{state='lost';x32.emit('status',x32.status());},reconnect:()=>{state='connected';x32.emit('snapshot',x32.snapshot());}};
}
test('old config with Ableton mixes stays ableton; fresh config defaults to x32',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'x32-config-'));t.after(()=>fs.rmSync(dir,{recursive:true}));const file=path.join(dir,'config.json');
 a.equal(loadConfig(file).mixSource,'x32');fs.writeFileSync(file,JSON.stringify({port:8765,username:'band',password:'',accessEnabled:true,members:[{id:'a',name:'A',pages:[],mixes:['A']}]}));a.equal(loadConfig(file).mixSource,'ableton');a.deepEqual(loadConfig(file).members[0].buses,[]);
});
test('member writes own bus only; even bus of linked pair maps to odd',async t=>{
 const s=await setup(t);a.equal((await s.req('/api/x32-send',{bus:6,source:'ch/01',value:0.7})).status,204);a.deepEqual(s.writes,[[5,'ch/01',0.7]]);a.equal((await s.req('/api/x32-send',{bus:7,source:'master',value:0.2})).status,403);const view=(await s.req('/api/x32')).json();a.deepEqual(view.buses.map(b=>b.bus),[5]);a.equal(view.levels[5].master.label,'-10.0 dB');
});
test('send refused 409 while lost; release after drop not written; no write on reconnect',async t=>{
 const s=await setup(t);await s.req('/api/x32-send',{bus:5,source:'master',value:0.1});await s.req('/api/x32-send',{bus:5,source:'master',value:0.9});s.drop();a.equal((await s.req('/api/x32-send',{bus:5,source:'master',value:0.8})).status,409);s.reconnect();await sleep(100);a.deepEqual(s.writes,[[5,'master',0.1]]);
});
test('hidden list saved per member per bus and never contains master',async t=>{
 const s=await setup(t);a.equal((await s.req('/api/x32-hidden',{bus:6,hidden:['ch/01']},'a','PUT')).status,204);a.deepEqual((await s.req('/api/x32')).json().hidden[5],['ch/01']);a.deepEqual((await s.req('/api/x32',undefined,'b')).json().hidden[7],['ch/02']);for(const hidden of [['master'],['ch/99']])a.equal((await s.req('/api/x32-hidden',{bus:5,hidden},'a','PUT')).status,400);a.equal((await s.req('/api/x32-hidden',{bus:7,hidden:[],member:'b'},'a','PUT')).status,403);
});
test('bus not on desk reported not-available',async t=>{
 const s=await setup(t,{members:[{id:'a',name:'Alice',pages:[],mixes:[],buses:[16],hidden:{}}]});a.deepEqual((await s.req('/api/x32')).json().unavailableBuses,[16]);a.equal((await s.req('/api/x32-send',{bus:16,source:'master',value:0.4})).status,409);
});
test('toMain bus assignment warns but saves',async t=>{
 const s=await setup(t,{adminPassword:'pw'});const members=s.app.getConfig().members;a.equal((await s.req('/api/members',{members},'admin')).json().warning,'Bus 5 is routed to Main LR');a.deepEqual(s.app.getConfig().members[0].buses,[6]);
});
test('x32 writes coalesce last value; source switch rejects and cancels pending',async t=>{
 const s=await setup(t,{adminPassword:'pw'});for(const value of [0.1,0.2,0.3])await s.req('/api/x32-send',{bus:5,source:'master',value});await sleep(80);a.deepEqual(s.writes,[[5,'master',0.1],[5,'master',0.3]]);a.equal((await s.req('/api/x32-settings',{mixSource:'ableton'},'admin','PUT')).status,200);a.equal((await s.req('/api/x32-send',{bus:5,source:'master',value:0.4})).status,409);
});
test('settings are admin only and validate host; invalid member fields rejected',async t=>{
 const s=await setup(t,{adminPassword:'pw'});a.equal((await s.req('/api/x32-settings',{host:null},'a','PUT')).status,403);for(const host of ['999.1.1.1','localhost','1.2.3'])a.equal((await s.req('/api/x32-settings',{host},'admin','PUT')).status,400);a.equal((await s.req('/api/x32-settings',{host:'192.168.1.32'},'admin','PUT')).status,200);a.equal(s.x32.host,'192.168.1.32');a.equal(validMembers([{id:'a',name:'A',pages:[],mixes:[],buses:[17]}]),false);
});
test('x32level throttled per client and duplicate values suppressed',async t=>{
 const s=await setup(t,{accessEnabled:false});const events=[];const r=http.get(`http://127.0.0.1:${s.port}/api/events`,res=>res.on('data',c=>events.push(c.toString())));t.after(()=>r.destroy());await sleep(30);
 for(const value of [0.5,0.5,0.6,0.7])s.x32.emit('level',{bus:5,source:'ch/01',value});await sleep(140);let levels=events.join('').split('\n\n').filter(v=>v.startsWith('event: x32level'));a.equal(levels.length,2);a.match(levels[1],/"value":0.7/);s.x32.emit('level',{bus:5,source:'ch/01',value:0.7});await sleep(120);a.equal(events.join('').split('event: x32level').length-1,2);
});
test('SSE filters current identity, metadata refreshes, and snapshot echoes do not duplicate levels',async t=>{
 const s=await setup(t);const events=[];const cookie='st_id='+sign(memberToken(s.app.getConfig().members[0]),s.app.getConfig().secret);
 const r=http.get({hostname:'127.0.0.1',port:s.port,path:'/api/events',headers:{Cookie:cookie}},res=>res.on('data',c=>events.push(c.toString())));t.after(()=>r.destroy());await sleep(30);
 s.x32.emit('level',{bus:5,source:'ch/01',value:0.4});s.x32.emit('level',{bus:7,source:'master',value:0.9});await sleep(30);a.equal(events.join('').includes('event: x32level'),false);
 s.snapshot.buses[0].name='New mix';s.x32.emit('meta',{});await sleep(30);a.match(events.join(''),/New mix/);a.equal(events.join('').includes('"bus":7'),false);
});
test('open access keeps own bus first and admin can edit a member hidden list',async t=>{
 const s=await setup(t,{accessEnabled:false,adminPassword:'pw'});a.deepEqual((await s.req('/api/x32',undefined,'b')).json().buses.map(b=>b.bus),[7,5]);a.equal((await s.req('/api/x32-hidden',{bus:6,member:'a',hidden:[]},'admin','PUT')).status,204);a.deepEqual((await s.req('/api/x32?member=a',undefined,'admin')).json().hidden[5],[]);
});
test('queued write rechecks member permission after revocation',async t=>{
 const s=await setup(t,{adminPassword:'pw'});await s.req('/api/x32-send',{bus:5,source:'master',value:0.1});await s.req('/api/x32-send',{bus:5,source:'master',value:0.9});const members=s.app.getConfig().members.map(m=>({...m,buses:[]}));await s.req('/api/members',{members},'admin');await sleep(80);a.deepEqual(s.writes,[[5,'master',0.1]]);
});

test('leading-zero IPv4 hosts are rejected clearly without applying settings',async t=>{
 const s=await setup(t,{adminPassword:'pw'});
 for(const host of ['192.168.001.032','01.2.3.4','1.2.3.00']) {
   const r=await s.req('/api/x32-settings',{host},'admin','PUT');
   a.equal(r.status,400);a.match(r.data,/without leading zeros/);
 }
 a.equal(s.x32.host,undefined);a.equal(s.app.getConfig().x32Host,null);
 for(const host of ['192.168.0.32',null])a.equal((await s.req('/api/x32-settings',{host},'admin','PUT')).status,200);
});
test('identified open member saves hidden lists on any visible bus; access-on stays restricted',async t=>{
 const s=await setup(t,{accessEnabled:false});
 a.equal((await s.req('/api/x32-hidden',{bus:7,hidden:['ch/01']},'a','PUT')).status,204);
 a.deepEqual((await s.req('/api/x32')).json().hidden[7],['ch/01']);
 a.deepEqual((await s.req('/api/x32',undefined,'b')).json().hidden[7],['ch/02']);
 a.equal((await s.req('/api/x32-hidden',{bus:7,hidden:[]},'unknown','PUT')).status,403);
 const locked=await setup(t);
 a.equal((await locked.req('/api/x32-hidden',{bus:7,hidden:[]},'a','PUT')).status,403);
 a.equal((await locked.req('/api/x32-hidden',{bus:6,hidden:[]},'a','PUT')).status,204);
});
test('eight phones share snapshot copies and level builds by permission set per change',()=>{
 const {createX32Mix}=require('../device/lib/x32-mix');
 const x32=new EventEmitter();let copies=0,builds=0;
 const desk={sources:[{id:'ch/01',name:'Vox'}],buses:[5,7].map(bus=>({bus,name:'Mix',master:0.5,sends:{'ch/01':0.2}}))};
 x32.snapshot=()=>{copies++;const copy=JSON.parse(JSON.stringify(desk));
   // Enumerating sends counts level-table builds independently of snapshot reads.
   for(const bus of copy.buses)bus.sends=new Proxy(bus.sends,{ownKeys(target){builds++;return Reflect.ownKeys(target);}});
   return copy;
 };
 x32.status=()=>({state:'connected'});x32.busFor=n=>n;
 const member={buses:[5],hidden:{}},cfg={mixSource:'x32',members:[member]};
 const mix=createX32Mix({x32,config:()=>cfg,send:()=>{}});
 try {
   const initialCopies=copies,initialBuilds=builds;
   for(let i=0;i<8;i++)mix.connect(new EventEmitter(),()=>({kind:'member',member}));
   a.equal(copies,initialCopies);a.equal(builds-initialBuilds,1);
   for(let i=0;i<8;i++)a.ok(mix.ready());a.equal(copies,initialCopies);
   const view=mix.view({kind:'member',member});
   a.strictEqual(mix.view({kind:'member',member}).levels,view.levels);
   a.deepEqual(view.buses.map(b=>b.bus),[5]);
   const before=builds;x32.emit('snapshot');
   a.equal(copies,initialCopies+1);a.equal(builds-before,3); // two dedupe seeds + one permitted level table
   const prior=copies;
   desk.buses[0].master=0.7;x32.emit('level',{bus:5,source:'master',value:0.7});
   for(let i=0;i<8;i++)a.ok(mix.ready());
   a.equal(copies,prior);a.equal(mix.view({kind:'member',member}).levels[5].master.value,0.7);
   const restricted=mix.view({kind:'member',member});
   const open=mix.view({kind:'open',member});
   a.deepEqual(open.buses.map(b=>b.bus),[5,7]);a.notStrictEqual(open.levels,restricted.levels);
   desk.buses[0].name='New name';x32.emit('meta');
   a.equal(mix.view({kind:'member',member}).buses[0].name,'New name');
   member.buses=[7];a.deepEqual(mix.view({kind:'member',member}).buses.map(b=>b.bus),[7]);
 } finally {mix.close();}
});
