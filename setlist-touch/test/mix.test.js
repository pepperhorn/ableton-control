const {test} = require('node:test');
const a = require('node:assert/strict'), fs = require('fs'), vm = require('vm'), path = require('path');
const device = path.join(__dirname,'../device');
function harness({wrapped = false, size} = {}) {
  const fixture = JSON.parse(JSON.stringify(require('../device/lib/fixture-mix.json')));
  const data = {live_set:{tracks:fixture.tracks.flatMap(t=>['id',100+t.index]),return_tracks:fixture.returns.flatMap(r=>['id',200+r.index])}};
  for (const r of fixture.returns) data[`live_set return_tracks ${r.index}`]={...r,output_routing_type:JSON.stringify(wrapped ? {output_routing_type:{display_name:r.routedToMain?'Main':'Ext. Out'}} : {display_name:r.routedToMain?'Main':'Ext. Out'})};
  for (const t of fixture.tracks) {
    data[`live_set tracks ${t.index}`]=t;
    t.sends.forEach((s,j)=>data[`live_set tracks ${t.index} mixer_device sends ${j}`]={...s});
  }
  data['live_set tracks 1'].name='+Kick';
  if(size){
    data.live_set.tracks=Array.from({length:size},(_,i)=>['id',100+i]).flat();
    data.live_set.return_tracks=Array.from({length:6},(_,i)=>['id',200+i]).flat();
    for(let j=0;j<6;j++)data['live_set return_tracks '+j]={name:'Return '+j,color:j,output_routing_type:JSON.stringify({display_name:'Ext. Out'})};
    for(let i=0;i<size;i++){
      data['live_set tracks '+i]={name:'+ Track '+i,color:i};
      for(let j=0;j<6;j++)data['live_set tracks '+i+' mixer_device sends '+j]={value:0.5,label:'-6 dB'};
    }
  }
  let operations=0,now=0;const ticks=[];
  const observers=[],apis=[],writeApis=[],failGets={},tasks=[],dict={},out=[],writes=[],logs=[];
  function LiveAPI(cb,p) {
    operations++;apis.push(this);this.path=typeof cb==='string'?cb:p;this._id=1;Object.defineProperty(this,'id',{get:()=>this._id,set:v=>{operations++;this._id=v;}});this.callback=typeof cb==='function'?cb:null;
    this.get=prop=>{operations++;const key=this.path+':'+prop;if(failGets[key]>0){failGets[key]--;throw Error('Transient read '+key);}if(!(prop in data[this.path]))throw Error(prop);return [data[this.path][prop]].flat();};
    this.getcount=prop=>{operations++;return data[this.path][prop].length/2;};
    this.call=(method,value)=>{operations++;a.equal(method,'str_for_value');if(data[this.path].failLabel)throw Error('label');return [data[this.path].label];};
    this.set=(prop,v)=>{writeApis.push(this);data[this.path][prop]=v;writes.push([this.path,prop,v]);changed(this.path,prop);};
    if(this.callback)observers.push(this);
    Object.defineProperty(this,'property',{get:()=>this._property,set:v=>{operations++;this._property=v;if(this.callback&&v)this.callback([v,...this.get(v)]);}});
  }
  function Task(fn,context) {this.fn=fn.bind(context);this.schedule=ms=>{this.scheduled=true;this.ms=ms;this.due=now+ms;};this.cancel=()=>this.scheduled=false;tasks.push(this);}
  function Dict(){this.set=(key,value)=>dict[key]=value;}
  const changed=(p,prop)=>{for(const o of observers.filter(o=>o.id&&o.path===p&&o.property===prop))o.callback([prop,...o.get(prop)]);};
  const tick=(task=tasks.filter(t=>t.scheduled).sort((a,b)=>a.due-b.due)[0])=>{if(!task)return false;now=Math.max(now,task.due);task.scheduled=false;const before=operations;task.fn();ticks.push(operations-before);return true;};
  const flush=()=>{for(let pass=0;pass<20000;pass++)if(!tick())return;throw Error('Task loop');};
  const ctx=vm.createContext({LiveAPI,Task,Dict,outlet:(...args)=>out.push(args),post:msg=>logs.push(msg)});
  vm.runInContext(fs.readFileSync(path.join(device,'mix.js'),'utf8'),ctx);
  const destroy=()=>{
    const before=operations,emitted=out.length;
    ctx.notifydeleted();a.equal(operations,before,'deletion makes no LiveAPI calls');
    observers.filter(o=>o.id&&o.callback).forEach(o=>o.callback());
    a.equal(out.length,emitted);a.ok(tasks.every(t=>!t.scheduled));
    // Model host-owned cleanup after js destruction, outside notifydeleted.
    apis.forEach(api=>api._id=0);
  };
  return {destroy,ctx,data,observers,apis,writeApis,failGets,tasks,dict,out,writes,logs,changed,flush,tick,ticks,get operations(){return operations;},get now(){return now;}};
}
test('mix is lazy, selects literal prefix, reads labels and observes external sends only',()=>{
  const h=harness();a.equal(h.observers.length,0);h.ctx.refresh();h.flush();h.flush();
  const raw=JSON.parse(h.dict.mix);a.equal(raw.tracks.length,9);a.equal(raw.returns.length,5);a.equal(raw.returns[0].routedToMain,true);
  a.equal(raw.tracks[0].sends[2].label,require('../device/lib/fixture-mix.json').tracks[0].sends[2].label);
  a.equal(h.observers.filter(o=>o.id&&o.property==='value').length,27);
  a.equal(h.tasks.length,3);a.ok(h.tasks.every(t=>!t.repeating));a.deepEqual(h.logs,[]);
});
test('routing handles Main/Master case-insensitively, invalid routing fails closed',()=>{
  const h=harness();h.ctx.refresh();h.flush();
  for(const name of ['Main','master','MAIN','Master']){h.data['live_set return_tracks 2'].output_routing_type=JSON.stringify({display_name:name});h.changed('live_set return_tracks 2','output_routing_type');h.flush();a.equal(JSON.parse(h.dict.mix).returns[2].routedToMain,true);}
  h.data['live_set return_tracks 2'].output_routing_type='bad';h.changed('live_set return_tracks 2','output_routing_type');h.flush();a.equal(JSON.parse(h.dict.mix).returns[2].routedToMain,null);
});
test('renames opt tracks in/out, rebuilds release observers and track/return changes rebind',()=>{
  const h=harness();h.ctx.refresh();h.flush();const count=h.observers.filter(o=>o.id).length;
  h.data['live_set tracks 1'].name='+ Kick';h.changed('live_set tracks 1','name');h.flush();a.equal(JSON.parse(h.dict.mix).tracks.length,10);
  a.equal(h.observers.filter(o=>o.id).length,count+3);h.ctx.refresh();h.flush();a.equal(h.observers.filter(o=>o.id).length,count+3);
  h.data.live_set.tracks=h.data.live_set.tracks.slice(0,-2);h.changed('live_set','tracks');h.flush();a.equal(JSON.parse(h.dict.mix).tracks.length,9);
  h.data.live_set.return_tracks=h.data.live_set.return_tracks.slice(0,-2);h.changed('live_set','return_tracks');h.flush();a.equal(JSON.parse(h.dict.mix).returns.length,4);
  h.destroy();a.equal(h.observers.filter(o=>o.id).length,0);a.ok(h.tasks.every(t=>!t.scheduled));
});
test('level batches use Live text and set sends validates final names, structure and routing',()=>{
  const h=harness();h.ctx.refresh();h.flush();
  h.ctx.send(0,2,0.8,'+ DRUMS','Shaun');h.flush();a.equal(h.writes.length,1);a.ok(h.out.some(o=>o[1]==='level'&&o[4]===0.8));
  h.ctx.send(0,0,0.8);h.ctx.send(0,2,2);h.ctx.send(0.5,2,0.4);a.equal(h.writes.length,1);
  h.data['live_set tracks 0'].name='+ NEW';h.ctx.send(0,2,0.9,'+ DRUMS','Shaun');a.equal(h.writes.length,1);h.flush();
  h.data['live_set return_tracks 2'].output_routing_type=JSON.stringify({display_name:'Main'});h.ctx.send(0,2,0.9,'+ DRUMS','Shaun');a.equal(h.writes.length,1);h.flush();
  h.data.live_set.tracks.reverse();h.ctx.send(0,3,0.9,'+ NEW','Keith');a.equal(h.writes.length,1);
});
test('value changes are coalesced without snapshot rebuild; label failures use UI fallback',()=>{
  const h=harness();h.ctx.refresh();h.flush();h.out.length=0;
  const p='live_set tracks 0 mixer_device sends 2';h.data[p].value=0.5;h.changed(p,'value');h.data[p].value=0.7;h.changed(p,'value');
  h.data[p].failLabel=true;h.flush();a.deepEqual(h.out,[[0,'level',0,2,0.7,'']]);
});
test('device routes send through deferlow; refresh initializes both lanes',()=>{
  const p=JSON.parse(fs.readFileSync(path.join(device,'SetlistTouch.maxpat'))).patcher;
  const boxes=Object.fromEntries(p.boxes.map(({box})=>[box.id,box]));
  a.equal(boxes.route.text,'route fire address url ready send progress');a.equal(boxes['send-defer'].text,'deferlow');
  for(const [src,dst,outlet] of [['route','send-defer',4],['send-defer','send',0],['send','mix',0],['refresh','mix',0],['mix','node',0]])
    a.ok(p.lines.some(({patchline:l})=>l.source[0]===src&&l.source[1]===outlet&&l.destination[0]===dst));
});

test('deferred commands retain expected names even after a newer snapshot rebuild',()=>{
 const h=harness();h.ctx.refresh();h.flush();h.data['live_set tracks 0'].name='+ NEW';h.changed('live_set tracks 0','name');h.flush();
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

test('routing unwraps Max LiveAPI JSON-string arrays, including final write validation',()=>{
 const h=harness({wrapped:true});h.ctx.refresh();h.flush();
 const api=h.observers.find(o=>o.path==='live_set return_tracks 2'&&o.property==='name');
 a.deepEqual(api.get('output_routing_type'),[JSON.stringify({output_routing_type:{display_name:'Ext. Out'}})]);
 let raw=JSON.parse(h.dict.mix);a.equal(raw.returns[0].routedToMain,true);a.equal(raw.returns[2].routedToMain,false);
 a.equal(h.observers.filter(o=>o.id&&o.property==='value').length,27);
 h.ctx.send(0,2,0.6,'+ DRUMS','Shaun');a.equal(h.writes.length,1);
 for(const [routing,expected] of [
  [{output_routing_type:{display_name:'Master'}},true],
  [{output_routing_type:{display_name:'Ext. Out'}},false],
  [{output_routing_type:null,display_name:'Ext. Out'},null],
  [{output_routing_type:{}},null],
  [{display_name:'Ext. Out'},false]
 ]){h.data['live_set return_tracks 2'].output_routing_type=JSON.stringify(routing);h.changed('live_set return_tracks 2','output_routing_type');h.flush();raw=JSON.parse(h.dict.mix);a.equal(raw.returns[2].routedToMain,expected);}
});
test('failed rebuild retries with capped backoff, recovers without an edit and releases partial bindings',()=>{
 const h=harness();h.failGets['live_set tracks 0:color']=20;h.ctx.refresh();while(h.tasks[2].scheduled)h.tick(h.tasks[2]);
 const retry=h.tasks[0];
 for(const delay of [1000,2000,4000,8000,8000]){
  a.deepEqual(JSON.parse(h.dict.mix),{returns:[],tracks:[]});
  a.equal(retry.scheduled,true);a.equal(retry.ms,delay);
  a.equal(h.apis.filter(api=>api.id).length,3,'only the root and its two observers survive a failed bind');
  // Root itself is also retained until deletion.
  retry.scheduled=false;retry.fn();while(h.tasks[2].scheduled)h.tick(h.tasks[2]);
 }
 h.failGets['live_set tracks 0:color']=0;retry.scheduled=false;retry.fn();while(h.tasks[2].scheduled)h.tick(h.tasks[2]);
 a.equal(JSON.parse(h.dict.mix).tracks.length,9);a.equal(retry.scheduled,false);
 h.failGets['live_set tracks 0:color']=1;h.ctx.rebuild();while(h.tasks[2].scheduled)h.tick(h.tasks[2]);a.equal(retry.ms,1000,'successful recovery resets backoff');
 h.destroy();a.equal(h.apis.filter(api=>api.id).length,0);a.ok(h.tasks.every(t=>!t.scheduled));
});
test('send reuses observed track/return/parameter objects and releases them on rebind and delete',()=>{
 const h=harness();h.ctx.refresh();h.flush();const created=h.apis.length;
 const sendApi=h.observers.find(o=>o.path==='live_set tracks 0 mixer_device sends 2'&&o.property==='value');
 for(let i=0;i<20;i++)h.ctx.send(0,2,i/20,'+ DRUMS','Shaun');
 a.equal(h.apis.length,created);a.equal(h.writes.length,20);a.ok(h.writeApis.every(api=>api===sendApi));
 const oldApis=h.apis.slice();h.ctx.rebuild();h.flush();a.equal(sendApi.id,0);a.ok(oldApis.filter(api=>api.path!=='live_set').every(api=>api.id===0));
 h.destroy();a.ok(h.apis.every(api=>api.id===0));
});

test('failed observer subscription is released before retrying the snapshot',()=>{
 const h=harness();h.failGets['live_set tracks 0:name']=1;h.ctx.refresh();while(h.tasks[2].scheduled)h.tick(h.tasks[2]);
 a.deepEqual(JSON.parse(h.dict.mix),{returns:[],tracks:[]});
 a.equal(h.apis.filter(api=>api.id).length,3);a.equal(h.tasks[0].ms,1000);
 h.flush();a.equal(JSON.parse(h.dict.mix).tracks.length,9);
 h.destroy();a.ok(h.apis.every(api=>api.id===0));
});

test('100 tracks and six returns index in bounded slices and cancel cleanly',()=>{
 const h=harness({size:100});h.ctx.refresh();const startup=h.operations;a.equal(h.dict.mix,undefined);h.flush();
 a.equal(JSON.parse(h.dict.mix).tracks.length,100);a.equal(JSON.parse(h.dict.mix).returns.length,6);
 a.ok(h.ticks.every(n=>n<=150),Math.max(...h.ticks));a.ok(startup<=150);
 console.log('MIX budget',JSON.stringify({tracks:100,returns:6,startup,worst:Math.max(...h.ticks),ticks:h.ticks.length,estimatedMs:h.ticks.length*h.ctx.MIX_SLICE_MS}));
 h.ticks.length=0;h.ctx.rebuild();h.flush();a.ok(h.ticks.every(n=>n<=150));
 h.ctx.rebuild();h.tick();h.destroy();a.ok(h.apis.every(api=>api.id===0));a.ok(h.tasks.every(t=>!t.scheduled));
 h.ctx.refresh();h.flush();a.equal(JSON.parse(h.dict.mix).tracks.length,100);
});

test('send echoes received between index slices are retained after completion',()=>{
 const h=harness();h.ctx.refresh();
 const target='live_set tracks 0 mixer_device sends 2';
 while(!h.observers.some(o=>o.id&&o.path===target))h.tick();
 h.data[target].value=0.83;h.changed(target,'value');h.flush();
 a.ok(h.out.some(o=>o[1]==='level'&&o[2]===0&&o[3]===2&&o[4]===0.83));
 a.equal(h.ctx.snapshot.tracks[0].sends[2].value,0.83);
});


test('ready preserves the mix scan and replays its completed snapshot without rebinding',()=>{
 const h=harness({size:100});h.ctx.ready();for(let i=0;i<20;i++)h.tick();
 const scan=h.ctx.scan,index=scan.index,apis=h.apis.length,tasks=h.tasks.length;
 h.ctx.ready();a.equal(h.ctx.scan,scan);a.equal(scan.index,index);a.equal(h.apis.length,apis);a.equal(h.tasks.length,tasks);
 h.flush();const before=h.operations;h.out.length=0;h.ctx.ready();
 a.deepEqual(h.out,[[0,'mix']]);a.equal(h.operations,before);a.equal(h.tasks.length,tasks);
});

test('untagged mix tracks batch within budget and only tagged tracks enter the send phase',()=>{
 const h=harness({size:100});for(let i=1;i<100;i++)h.data['live_set tracks '+i].name='Track '+i;
 h.ctx.refresh();h.flush();a.equal(JSON.parse(h.dict.mix).tracks.length,1);
 a.ok(h.ticks.every(n=>n<=150));a.ok(h.ticks.length<20);
 console.log('MIX mostly untagged budget',JSON.stringify({tracks:100,tagged:1,worst:Math.max(...h.ticks),ticks:h.ticks.length,indexMs:h.now}));
});

for(const change of ['rename','colour','add','remove'])test('100-track '+change+' rescan keeps valid phone fader writes available',()=>{
 const h=harness({size:100});h.ctx.refresh();h.flush();h.ticks.length=0;
 if(change==='rename')h.data['live_set tracks 99'].name='+ Renamed';
 if(change==='colour')h.data['live_set tracks 99'].color=12345;
 if(change==='add'){
  h.data.live_set.tracks.push('id',999);
  h.data['live_set tracks 100']={name:'New untagged track',color:0};
 }
 if(change==='remove')h.data.live_set.tracks.splice(-2);
 h.changed(change==='add'||change==='remove'?'live_set':'live_set tracks 99',change==='rename'?'name':change==='colour'?'color':'tracks');
 const start=h.now;let attempts=0;
 do {
  const before=h.writes.length;h.ctx.send(0,0,0.6,'+ Track 0','Return 0');attempts++;
  a.equal(h.writes.length,before+1,'valid target remains writable through debounce, scan and retirement');
 }while((h.ctx.dirty||h.tasks[0].scheduled||h.tasks[2].scheduled)&&h.tick());
 h.flush();
 a.ok(attempts>100);a.ok(h.ticks.every(n=>n<=150));
 console.log('MIX fader window',JSON.stringify({change,tracks:100,deadMs:0,rescanMs:h.now-start,attempts,worst:Math.max(...h.ticks)}));
});

test('rescan rejects renamed/replaced/moved targets and unreadable or Main routing without extending debounce',()=>{
 const h=harness({size:100});h.ctx.refresh();h.flush();
 h.data['live_set tracks 0'].name='+ Renamed';h.changed('live_set tracks 0','name');
 const due=h.tasks[0].due;
 for(let i=0;i<5;i++)h.ctx.send(0,0,0.9,'+ Track 0','Return 0');
 a.equal(h.writes.length,0);a.equal(h.tasks[0].due,due);h.flush();
 h.ctx.send(0,0,0.6,'+ Renamed','Return 0');a.equal(h.writes.length,1);
 // Names remain identical but IDs move or are replaced before callbacks arrive.
 h.data.live_set.tracks[1]=999;h.ctx.send(0,0,0.9,'+ Renamed','Return 0');a.equal(h.writes.length,1);
 h.data.live_set.tracks[1]=100;h.data.live_set.return_tracks[1]=999;
 h.ctx.send(0,0,0.9,'+ Renamed','Return 0');a.equal(h.writes.length,1);
 h.data.live_set.return_tracks[1]=200;
 for(const route of ['bad',JSON.stringify({display_name:'Main'})]){
  h.data['live_set return_tracks 0'].output_routing_type=route;
  h.ctx.send(0,0,0.9,'+ Renamed','Return 0');a.equal(h.writes.length,1);
 }
 h.data['live_set return_tracks 0'].output_routing_type=JSON.stringify({display_name:'Ext. Out'});
 h.data['live_set return_tracks 0'].name='Renamed return';
 h.ctx.send(0,0,0.9,'+ Renamed','Return 0');a.equal(h.writes.length,1);
});

test('writes through the old snapshot after its replacement read still echo the final Live value',()=>{
 const h=harness({size:100});h.ctx.refresh();h.flush();h.ctx.rebuild();
 while(!h.ctx.sendApis['0:0'])h.tick(h.tasks[2]);
 a.ok(h.ctx.scan);h.ctx.send(0,0,0.83,'+ Track 0','Return 0');h.flush();
 a.equal(h.ctx.snapshot.tracks[0].sends[0].value,0.83);
 a.ok(h.out.some(o=>o[1]==='level'&&o[2]===0&&o[3]===0&&o[4]===0.83));
});


test('deleting overlapping published and partial mix generations makes no LiveAPI calls and callbacks stay inert',()=>{
 const h=harness({size:100});h.ctx.refresh();h.flush();h.ctx.rebuild();
 for(let i=0;i<30;i++)h.tick();a.ok(h.ctx.published&&h.ctx.scan);h.destroy();
 a.equal(h.ctx.published,null);a.equal(h.ctx.root,null);
});


test('published faders echo within 33 ms during a rescan and draft callbacks stay private until publication',()=>{
 const h=harness({size:100});h.ctx.refresh();h.flush();h.ctx.rebuild();
 const start=h.now;h.out.length=0;h.ctx.send(0,0,0.73,'+ Track 0','Return 0');
 while(!h.out.some(o=>o[1]==='level'))a.ok(h.tick());
 a.equal(h.now-start,33);a.ok(h.ctx.dirty);a.ok(h.ctx.scan);
 a.equal(h.ctx.snapshot.tracks[0].sends[0].value,0.73);
 while(!h.ctx.sendApis['0:0'])a.ok(h.tick());
 const draft=h.ctx.sendApis['0:0'];h.out.length=0;
 h.data[draft.path].value=0.91;draft.callback();
 h.tick(h.tasks[1]);a.ok(!h.out.some(o=>o[1]==='level'),'unpublished generation cannot emit levels');
 h.flush();a.ok(h.out.some(o=>o[1]==='level'&&o[4]===0.91));
});

test('ready rewrites the mix Dict so a restarted Node replays current levels',()=>{
 const h=harness({size:4});h.ctx.refresh();h.flush();
 h.data['live_set tracks 0 mixer_device sends 2'].value=0.9;h.changed('live_set tracks 0 mixer_device sends 2','value');h.flush();
 a.equal(JSON.parse(h.dict.mix).tracks[0].sends[2].value,0.5);
 h.ctx.ready();a.equal(JSON.parse(h.dict.mix).tracks[0].sends[2].value,0.9);
});

test('any change to the return list rejects sends, even to an untouched return slot',()=>{
 const h=harness({size:4});h.ctx.refresh();h.flush();
 h.ctx.send(0,3,0.7,'+ Track 0','Return 3');a.equal(h.writes.length,1);
 h.data.live_set.return_tracks[1]=999;
 h.ctx.send(0,3,0.8,'+ Track 0','Return 3');a.equal(h.writes.length,1);
});
