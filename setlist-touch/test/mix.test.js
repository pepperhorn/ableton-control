const {test} = require('node:test');
const a = require('node:assert/strict'), fs = require('fs'), vm = require('vm'), path = require('path');
const device = path.join(__dirname,'../device');
function harness() {
  const fixture = JSON.parse(JSON.stringify(require('../device/lib/fixture-mix.json')));
  const data = {live_set:{tracks:fixture.tracks.flatMap(t=>['id',100+t.index]),return_tracks:fixture.returns.flatMap(r=>['id',200+r.index])}};
  for (const r of fixture.returns) data[`live_set return_tracks ${r.index}`]={...r,output_routing_type:JSON.stringify({display_name:r.routedToMain?'Main':'Ext. Out'})};
  for (const t of fixture.tracks) {
    data[`live_set tracks ${t.index}`]=t;
    t.sends.forEach((s,j)=>data[`live_set tracks ${t.index} mixer_device sends ${j}`]={...s});
  }
  data['live_set tracks 1'].name='+Kick';
  const observers=[],tasks=[],dict={},out=[],writes=[],logs=[];
  function LiveAPI(cb,p) {
    this.path=typeof cb==='string'?cb:p;this.id=1;this.callback=typeof cb==='function'?cb:null;
    this.get=prop=>{if(!(prop in data[this.path]))throw Error(prop);return [data[this.path][prop]].flat();};
    this.getcount=prop=>data[this.path][prop].length/2;
    this.call=(method,value)=>{a.equal(method,'str_for_value');if(data[this.path].failLabel)throw Error('label');return [data[this.path].label];};
    this.set=(prop,v)=>{data[this.path][prop]=v;writes.push([this.path,prop,v]);changed(this.path,prop);};
    if(this.callback)observers.push(this);
    Object.defineProperty(this,'property',{get:()=>this._property,set:v=>{this._property=v;if(this.callback&&v)this.callback([v,...this.get(v)]);}});
  }
  function Task(fn,context) {this.fn=fn.bind(context);this.schedule=ms=>{this.scheduled=true;this.ms=ms;};this.cancel=()=>this.scheduled=false;tasks.push(this);}
  function Dict(){this.set=(key,value)=>dict[key]=value;}
  const changed=(p,prop)=>{for(const o of observers.filter(o=>o.id&&o.path===p&&o.property===prop))o.callback([prop,...o.get(prop)]);};
  const flush=()=>{for(let pass=0;pass<10;pass++){const pending=tasks.filter(t=>t.scheduled);if(!pending.length)return;for(const task of pending){task.scheduled=false;task.fn();}}throw Error('Task loop');};
  const ctx=vm.createContext({LiveAPI,Task,Dict,outlet:(...args)=>out.push(args),post:msg=>logs.push(msg)});
  vm.runInContext(fs.readFileSync(path.join(device,'mix.js'),'utf8'),ctx);
  return {ctx,data,observers,tasks,dict,out,writes,logs,changed,flush};
}
test('mix is lazy, selects literal prefix, reads labels and observes external sends only',()=>{
  const h=harness();a.equal(h.observers.length,0);h.ctx.refresh();h.flush();
  const raw=JSON.parse(h.dict.mix);a.equal(raw.tracks.length,9);a.equal(raw.returns.length,5);a.equal(raw.returns[0].routedToMain,true);
  a.equal(raw.tracks[0].sends[2].label,require('../device/lib/fixture-mix.json').tracks[0].sends[2].label);
  a.equal(h.observers.filter(o=>o.id&&o.property==='value').length,27);
  a.equal(h.tasks.length,2);a.ok(h.tasks.every(t=>!t.repeating));a.deepEqual(h.logs,[]);
});
test('routing handles Main/Master case-insensitively, invalid routing fails closed',()=>{
  const h=harness();h.ctx.refresh();
  for(const name of ['Main','master','MAIN','Master']){h.data['live_set return_tracks 2'].output_routing_type=JSON.stringify({display_name:name});h.changed('live_set return_tracks 2','output_routing_type');h.flush();a.equal(JSON.parse(h.dict.mix).returns[2].routedToMain,true);}
  h.data['live_set return_tracks 2'].output_routing_type='bad';h.changed('live_set return_tracks 2','output_routing_type');h.flush();a.equal(JSON.parse(h.dict.mix).returns[2].routedToMain,null);
});
test('renames opt tracks in/out, rebuilds release observers and track/return changes rebind',()=>{
  const h=harness();h.ctx.refresh();const count=h.observers.filter(o=>o.id).length;
  h.data['live_set tracks 1'].name='+ Kick';h.changed('live_set tracks 1','name');h.flush();a.equal(JSON.parse(h.dict.mix).tracks.length,10);
  a.equal(h.observers.filter(o=>o.id).length,count+3);h.ctx.refresh();a.equal(h.observers.filter(o=>o.id).length,count+3);
  h.data.live_set.tracks=h.data.live_set.tracks.slice(0,-2);h.changed('live_set','tracks');h.flush();a.equal(JSON.parse(h.dict.mix).tracks.length,9);
  h.data.live_set.return_tracks=h.data.live_set.return_tracks.slice(0,-2);h.changed('live_set','return_tracks');h.flush();a.equal(JSON.parse(h.dict.mix).returns.length,4);
  h.ctx.notifydeleted();a.equal(h.observers.filter(o=>o.id).length,0);a.ok(h.tasks.every(t=>!t.scheduled));
});
test('level batches use Live text and set sends validates final names, structure and routing',()=>{
  const h=harness();h.ctx.refresh();
  h.ctx.send(0,2,0.8,'+ DRUMS','Shaun');h.flush();a.equal(h.writes.length,1);a.ok(h.out.some(o=>o[1]==='level'&&o[4]===0.8));
  h.ctx.send(0,0,0.8);h.ctx.send(0,2,2);h.ctx.send(0.5,2,0.4);a.equal(h.writes.length,1);
  h.data['live_set tracks 0'].name='+ NEW';h.ctx.send(0,2,0.9,'+ DRUMS','Shaun');a.equal(h.writes.length,1);h.flush();
  h.data['live_set return_tracks 2'].output_routing_type=JSON.stringify({display_name:'Main'});h.ctx.send(0,2,0.9,'+ DRUMS','Shaun');a.equal(h.writes.length,1);h.flush();
  h.data.live_set.tracks.reverse();h.ctx.send(0,3,0.9,'+ NEW','Keith');a.equal(h.writes.length,1);
});
test('value changes are coalesced without snapshot rebuild; label failures use UI fallback',()=>{
  const h=harness();h.ctx.refresh();h.out.length=0;
  const p='live_set tracks 0 mixer_device sends 2';h.data[p].value=0.5;h.changed(p,'value');h.data[p].value=0.7;h.changed(p,'value');
  h.data[p].failLabel=true;h.flush();a.deepEqual(h.out,[[0,'level',0,2,0.7,'']]);
});
test('device routes send through deferlow; refresh initializes both lanes',()=>{
  const p=JSON.parse(fs.readFileSync(path.join(device,'SetlistTouch.maxpat'))).patcher;
  const boxes=Object.fromEntries(p.boxes.map(({box})=>[box.id,box]));
  a.equal(boxes.route.text,'route fire address url ready send');a.equal(boxes['send-defer'].text,'deferlow');
  for(const [src,dst,outlet] of [['route','send-defer',4],['send-defer','send',0],['send','mix',0],['refresh','mix',0],['mix','node',0]])
    a.ok(p.lines.some(({patchline:l})=>l.source[0]===src&&l.source[1]===outlet&&l.destination[0]===dst));
});

test('deferred commands retain expected names even after a newer snapshot rebuild',()=>{
 const h=harness();h.ctx.refresh();h.data['live_set tracks 0'].name='+ NEW';h.changed('live_set tracks 0','name');h.flush();
 h.ctx.send(0,2,0.8,'+ DRUMS','Shaun');a.equal(h.writes.length,0);
 h.ctx.send(0,2,0.8,'+ NEW','Shaun');a.equal(h.writes.length,1);
});
test('Node for Max passes expected names intact and orders level events after the mix dict',async()=>{
 const handlers={},outlets=[],raw=require('../device/lib/fixture-mix.json');let bridge;
 const max={outlet:(...args)=>outlets.push(args),addHandler:(name,fn)=>handlers[name]=fn,getDict:async name=>{a.equal(name,'setlist_touch_mix');return {mix:JSON.stringify(raw)};},post:()=>{}};
 const req=name=>name==='max-api'?max:name==='./lib/app'?{createApp:options=>{bridge=options.bridge;return {listen:()=>Promise.resolve(8765),getConfig:()=>({port:8765})};}}:name==='./lib/config'?{loadConfig:()=>({})}:require(name);
 const ctx=vm.createContext({require:req,process:{on:()=>{}}});vm.runInContext(fs.readFileSync(path.join(device,'setlist-server.js'),'utf8'),ctx);
 const events=[];bridge.on('mix',v=>events.push(['mix',v]));bridge.on('level',v=>events.push(['level',v]));
 handlers.mix();handlers.level(0,2,0.5,'-4.1','dB');await new Promise(r=>setImmediate(r));
 a.equal(events[0][0],'mix');a.deepEqual(JSON.parse(JSON.stringify(events[1])),['level',{trackIndex:0,returnIndex:2,value:0.5,label:'-4.1 dB'}]);
 bridge.setSend(0,2,0.6);a.deepEqual(outlets.find(o=>o[0]==='send'),['send',0,2,0.6,'+ DRUMS','Shaun']);
});
