const {test}=require('node:test');const a=require('node:assert/strict');const vm=require('vm'),fs=require('fs'),path=require('path');
function harness(size){
 const outputs=[],calls=[],observers=[],tasks=[],dict={},logs=[],gets=[],writes=[];let created=0, operations=0, now=0; const ticks=[],progressTimes=[];
 const data={live_set:{scenes:['id',10,'id',11,'id',12],tracks:['id',20,'id',21],signature_numerator:4,signature_denominator:4},
 'live_set scenes 0':{name:'* RISE >>',color:0xffffff,time_signature_enabled:0},
 'live_set scenes 1':{name:'[N32] AA',color:0x22d44a,time_signature_enabled:0},
 'live_set scenes 2':{name:'6/8',color:0,time_signature_enabled:1,time_signature_numerator:6,time_signature_denominator:8},
 'live_set tracks 1':{playing_slot_index:1,fired_slot_index:2},
 'live_set tracks 1 clip_slots 0':{has_clip:0},
 'live_set tracks 1 clip_slots 1':{has_clip:1},
 'live_set tracks 1 clip_slots 2':{has_clip:1},
 'live_set tracks 1 clip_slots 1 clip':{is_audio_clip:0,loop_start:4,loop_end:132,playing_position:46},
 'live_set tracks 1 clip_slots 2 clip':{is_audio_clip:0,loop_start:0,loop_end:6,playing_position:1}};
 if(size!==undefined){
  data.live_set.scenes=Array.from({length:size},(_,i)=>['id',10+i]).flat();
  for(let i=0;i<size;i++){
   data['live_set scenes '+i]={name:i%20===0?'* Song '+i:'Row '+i,color:i,time_signature_enabled:1,time_signature_numerator:6,time_signature_denominator:8};
   data['live_set tracks 1 clip_slots '+i]={has_clip:1};
   data['live_set tracks 1 clip_slots '+i+' clip']={is_audio_clip:1,warping:1,loop_start:4,loop_end:132,playing_position:46};
  }
 }
 function LiveAPI(callback,p){created++;operations++;this.path=typeof callback==='string'?callback:p;this.callback=typeof callback==='function'?callback:null;this._id=1;Object.defineProperty(this,'id',{get:()=>this._id,set:v=>{operations++;this._id=v;}});this.get=prop=>{operations++;gets.push([this.path,prop]);if(!data[this.path]||!(prop in data[this.path]))throw new Error('Unknown '+this.path+' '+prop);const v=data[this.path][prop];return Array.isArray(v)?v:[v];};this.getcount=prop=>{operations++;return data[this.path][prop].length/2;};this.call=(...args)=>calls.push([this.path,...args]);Object.defineProperty(this,'property',{get:()=>this._property,set:v=>{operations++;this._property=v; if(v&&this.callback)this.callback([v]);}});if(this.callback)observers.push(this);}
 function Task(fn,context){this.fn=fn.bind(context);this.schedule=ms=>{this.pending=true;this.due=now+ms;};this.cancel=()=>{this.pending=false;this.repeating=false;};tasks.push(this);}
 function Dict(){this.set=(key,value)=>{dict[key]=value;writes.push([key,value]);};}
 const ctx=vm.createContext({LiveAPI,Task,Dict,outlet:(...args)=>{outputs.push(args);if(args[1]==='progress')progressTimes.push(now);},post:message=>logs.push(message)});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../device/lom.js'),'utf8'),ctx);
 const tick=(includeSweep=false)=>{
  const next=tasks.filter(t=>t.pending&&(includeSweep||t!==ctx.sweep)).sort((a,b)=>a.due-b.due)[0];
  if(!next)return false;
  now=Math.max(now,next.due);next.pending=false;const start=operations, reads=gets.length, made=created;
  next.fn();const rowReads=new Set(gets.slice(reads).filter(([p])=>/^live_set scenes \d+$/.test(p)).map(([p])=>p));
  ticks.push({time:now,operations:operations-start,created:created-made,sceneReads:rowReads.size});return true;
 };
 const flush=()=>{for(let pass=0;pass<20000;pass++)if(!tick())return;throw new Error('Task loop');};
 const advance=ms=>{const end=now+ms;for(let n=0;n<20000;n++){const next=tasks.filter(t=>t.pending).sort((a,b)=>a.due-b.due)[0];if(!next||next.due>end){now=end;return;}tick(true);}throw Error('Task loop');};

 const changed=(p,prop)=>{for(const o of observers.filter(o=>o.id&&o.path===p&&o.property===prop))o.callback([prop,...[].concat(data[p][prop])]);flush();};
 return {ctx,data,outputs,calls,observers,tasks,dict,logs,gets,writes,flush,tick,ticks,progressTimes,advance,changed,get created(){return created;}};
}
test('LiveAPI stays lazy, reads scenes/signatures/loops and fires valid scenes',()=>{const h=harness();a.equal(h.created,0);h.ctx.refresh();h.flush();const raw=JSON.parse(h.dict.scenes);a.equal(raw.length,3);a.equal(raw[1].loopBeats,128);a.equal(raw[0].loopBeats,null);a.equal(raw[2].beatsPerBar,3);h.ctx.fire(1,'[N32] AA');h.ctx.fire(-1);h.ctx.fire(99);h.ctx.fire(1.5);a.deepEqual(h.calls,[['live_set scenes 1','fire']]);a.ok(h.outputs.some(o=>o[1]==='scenes'));a.ok(h.outputs.some(o=>o[1]==='pos'&&o[2]===1&&o[3]===46&&o[4]===4));});
test('rename and signature observers rebuild without leaking observers',()=>{const h=harness();h.ctx.refresh();h.flush();const count=h.observers.filter(o=>o.id).length;h.data['live_set scenes 1'].name='RENAMED';h.changed('live_set scenes 1','name');a.equal(JSON.parse(h.dict.scenes)[1].name,'RENAMED');a.equal(h.observers.filter(o=>o.id).length,count);h.data.live_set.signature_numerator=3;h.changed('live_set','signature_numerator');a.equal(JSON.parse(h.dict.scenes)[1].beatsPerBar,3);});
test('playing slot retargets position and negative fired becomes -1',()=>{const h=harness();h.ctx.refresh();h.flush();h.data['live_set tracks 1'].playing_slot_index=2;h.data['live_set tracks 1'].fired_slot_index=-2;h.changed('live_set tracks 1','playing_slot_index');a.ok(h.outputs.some(o=>o[1]==='play'&&o[2]===2&&o[3]===-1));a.ok(h.outputs.some(o=>o[1]==='pos'&&o[2]===2&&o[6]===3));h.ctx.notifydeleted();a.equal(h.observers.filter(o=>o.id).length,0);});
test('track changes rebind to the final regular track; missing clips have no outline',()=>{
 const h=harness();h.ctx.refresh();h.flush();
 h.data.live_set.tracks=['id',20,'id',21,'id',22];
 h.data['live_set tracks 2']={playing_slot_index:1,fired_slot_index:0};
 for(let i=0;i<3;i++)h.data['live_set tracks 2 clip_slots '+i]={has_clip:0};
 h.changed('live_set','tracks');
 a.ok(h.observers.some(o=>o.id&&o.path==='live_set tracks 2'&&o.property==='playing_slot_index'));
 a.ok(!h.observers.some(o=>o.id&&o.path==='live_set tracks 1'));
 a.deepEqual(h.outputs.filter(o=>o[1]==='play').at(-1),[0,'play',-1,-1]);
 a.equal(JSON.parse(h.dict.scenes)[1].loopBeats,null);
});
test('explicit re-index catches loop edits and refresh cleans old observers',()=>{
 const h=harness();h.ctx.refresh();h.flush();const count=h.observers.filter(o=>o.id).length;
 h.data['live_set tracks 1 clip_slots 1 clip'].loop_end=68;h.ctx.rebuild();h.flush();
 a.equal(JSON.parse(h.dict.scenes)[1].loopBeats,64);
 h.ctx.refresh();h.flush();a.equal(h.observers.filter(o=>o.id).length,count);
});
test('fire rereads Live names even when the snapshot is stale, with exact string matching',()=>{
 const h=harness();h.ctx.refresh();h.flush();
 h.data['live_set scenes 1'].name='INSERTED';
 h.ctx.fire(1,'[N32] AA');h.ctx.fire(1);a.deepEqual(h.calls,[]);a.equal(h.logs.length,2);
 for(const name of ['', '  padded  ', 'A "quote" \\ tail', '42']) {
  h.data['live_set scenes 1'].name=name;h.ctx.fire(1,name);h.ctx.fire(1,name+' ');
 }
 a.equal(h.calls.length,4);a.equal(h.logs.length,6);
});
test('unchanged slow sweep skips writes and metadata, but catches loop edits',()=>{
 const h=harness();h.ctx.refresh();h.flush();const writes=h.writes.length;
 h.gets.length=0;h.outputs.length=0;h.advance(2000);
 a.equal(h.writes.length,writes);a.ok(!h.gets.some(([p])=>p.startsWith('live_set scenes ')));
 h.data['live_set tracks 1 clip_slots 1 clip'].loop_end=68;h.advance(1000);
 a.equal(h.writes.length,writes+1);a.equal(JSON.parse(h.dict.scenes)[1].loopBeats,64);
 h.ctx.refresh();h.flush();a.equal(h.writes.length,writes+2);
});
test('unwarped audio has no beat timing; warped audio and MIDI retain timing',()=>{
 const h=harness(),clip=h.data['live_set tracks 1 clip_slots 1 clip'];
 clip.is_audio_clip=1;clip.warping=0;h.ctx.refresh();h.flush();
 a.equal(JSON.parse(h.dict.scenes)[1].loopBeats,null);
 a.deepEqual(h.outputs.filter(o=>o[1]==='pos').at(-1),[0,'pos',1,0,0,0,4]);
 clip.warping=1;h.ctx.sweepTick();h.flush();h.ctx.positionChanged();a.equal(JSON.parse(h.dict.scenes)[1].loopBeats,128);
 a.equal(h.outputs.filter(o=>o[1]==='pos').at(-1)[3],46);
 clip.is_audio_clip=0;clip.warping=0;h.ctx.sweepTick();h.flush();h.ctx.positionChanged();a.equal(JSON.parse(h.dict.scenes)[1].loopBeats,128);
});

for(const size of [683,1000])test('bounded indexing at '+size+' scenes publishes only a complete snapshot',()=>{
 const h=harness(size);h.ctx.refresh();a.equal(h.dict.scenes,undefined);h.flush();
 const rows=JSON.parse(h.dict.scenes);a.equal(rows.length,size);
 for(let i=0;i<size;i++)a.deepEqual(rows[i],{index:i,name:i%20===0?'* Song '+i:'Row '+i,color:i,loopBeats:128,beatsPerBar:3});
 a.ok(h.ticks.every(t=>t.sceneReads<=h.ctx.CHUNK));a.ok(h.ticks.every(t=>t.created<=h.ctx.CHUNK*8));a.ok(h.ticks.every(t=>t.operations<=150),JSON.stringify(h.ticks.slice().sort((a,b)=>b.operations-a.operations).slice(0,3)));
 const progress=h.outputs.filter(o=>o[1]==='progress');a.equal(progress[0][2],0);a.equal(progress.at(-1)[2],size);
 a.ok(progress.every((p,i)=>p[3]===size&&(!i||p[2]>=progress[i-1][2])));
 a.ok(h.progressTimes.slice(1,-1).every((time,i)=>time-h.progressTimes[i]>=h.ctx.PROGRESS_MS));
 const worst=Math.max(...h.ticks.map(t=>t.operations));console.log('LOM budget',JSON.stringify({size,CHUNK:h.ctx.CHUNK,delay:h.ctx.SLICE_MS,worst,indexMs:h.progressTimes.at(-1),settledMs:h.ticks.at(-1).time}));
 h.gets.length=0;h.ticks.length=0;h.advance(60000);
 a.equal(h.gets.filter(([p])=>/^live_set scenes /.test(p)).length,0);
 a.ok(h.gets.filter(([p,prop])=>p.includes('clip_slots')&&prop==='has_clip').length<=180);
});
test('single-scene edits coalesce and global signature uses cached overrides',()=>{
 const h=harness(1000);h.ctx.refresh();h.flush();h.gets.length=0;
 h.data['live_set scenes 77'].name='renamed';h.changed('live_set scenes 77','name');
 a.deepEqual([...new Set(h.gets.filter(([p])=>p.startsWith('live_set scenes ')).map(([p])=>p))],['live_set scenes 77']);
 a.equal(JSON.parse(h.dict.scenes)[77].name,'renamed');h.gets.length=0;
 h.data.live_set.signature_numerator=7;h.changed('live_set','signature_numerator');
 a.equal(h.gets.filter(([p])=>p.startsWith('live_set scenes ')).length,0);a.equal(JSON.parse(h.dict.scenes)[77].beatsPerBar,3);
});
test('structure changes retain launchable old snapshot, chunk cleanup and cancel partial generations',()=>{
 const h=harness(1000);h.ctx.refresh();h.flush();const before=h.dict.scenes;
 h.data['live_set scenes 0'].name='* Replacement';h.ctx.rebuild();
 for(let i=0;i<5;i++)h.tick();a.equal(h.dict.scenes,before);
 h.ctx.fire(1,'Row 1');a.deepEqual(h.calls.at(-1),['live_set scenes 1','fire']);
 h.ctx.rebuild();h.flush();a.equal(JSON.parse(h.dict.scenes)[0].name,'* Replacement');
 a.ok(h.ticks.every(t=>t.operations<=150));a.equal(h.observers.filter(o=>o.id&&o.path.startsWith('live_set scenes ')).length,5000);
 h.ctx.rebuild();h.tick();h.ctx.notifydeleted();a.equal(h.observers.filter(o=>o.id).length,0);a.ok(h.tasks.every(t=>!t.pending));
 h.ctx.refresh();h.flush();a.equal(JSON.parse(h.dict.scenes).length,1000);
});
test('playback remains observable while a chunked re-index is in flight',()=>{
 const h=harness(1000);h.ctx.refresh();h.flush();h.ctx.rebuild();
 h.data['live_set tracks 1'].playing_slot_index=77;
 for(const o of h.observers.filter(o=>o.id&&o.path==='live_set tracks 1'&&o.property==='playing_slot_index'))o.callback();
 a.ok(h.ctx.scan);a.deepEqual(h.outputs.filter(o=>o[1]==='play').at(-1),[0,'play',77,2]);a.ok(h.outputs.some(o=>o[1]==='pos'&&o[2]===77));
 h.flush();
});

test('refresh mid-index cancels old tasks and drains observers within budget',()=>{
 const h=harness(1000);h.ctx.refresh();for(let i=0;i<100;i++)h.tick();
 const oldTasks=h.tasks.slice();h.ctx.refresh();a.ok(oldTasks.every(t=>!t.pending));h.flush();
 a.ok(h.ticks.every(t=>t.operations<=150));a.equal(h.observers.filter(o=>o.id&&o.path.startsWith('live_set scenes ')).length,5000);
 a.equal(JSON.parse(h.dict.scenes).length,1000);
});

test('scene-list notifications re-index in slices without publishing a partial replacement',()=>{
 const h=harness(1000);h.ctx.refresh();h.flush();const before=h.dict.scenes;
 h.data.live_set.scenes=h.data.live_set.scenes.slice(0,-2);
 for(const o of h.observers.filter(o=>o.id&&o.path==='live_set'&&o.property==='scenes'))o.callback(['scenes']);
 a.ok(h.ctx.scan);h.tick();a.equal(h.dict.scenes,before);h.flush();
 a.equal(JSON.parse(h.dict.scenes).length,999);a.ok(h.ticks.every(t=>t.operations<=150));
 a.equal(h.observers.filter(o=>o.id&&o.path==='live_set scenes 999').length,0);
});
test('deletion during an initial partial scan leaves no subscriptions or scheduled work',()=>{
 const h=harness(1000);h.ctx.refresh();h.tick();h.tick();a.equal(h.dict.scenes,undefined);
 h.ctx.notifydeleted();a.equal(h.observers.filter(o=>o.id).length,0);a.ok(h.tasks.every(t=>!t.pending));
 h.ctx.refresh();h.flush();a.equal(JSON.parse(h.dict.scenes).length,1000);
});
