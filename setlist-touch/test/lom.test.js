const {test}=require('node:test');const a=require('node:assert/strict');const vm=require('vm'),fs=require('fs'),path=require('path');
function harness(){
 const outputs=[],calls=[],observers=[],tasks=[],dict={},logs=[],gets=[],writes=[];let created=0;
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
 function LiveAPI(callback,p){created++;this.path=typeof callback==='string'?callback:p;this.callback=typeof callback==='function'?callback:null;this.id=1;this.get=prop=>{gets.push([this.path,prop]);if(!data[this.path]||!(prop in data[this.path]))throw new Error('Unknown '+this.path+' '+prop);const v=data[this.path][prop];return Array.isArray(v)?v:[v];};this.getcount=prop=>data[this.path][prop].length/2;this.call=(...args)=>calls.push([this.path,...args]);if(this.callback)observers.push(this);}
 function Task(fn,context){this.fn=fn.bind(context);this.schedule=()=>{this.pending=true;};this.cancel=()=>{this.pending=false;this.repeating=false;};this.repeat=()=>{this.repeating=true;};tasks.push(this);}
 function Dict(){this.set=(key,value)=>{dict[key]=value;writes.push([key,value]);};}
 const ctx=vm.createContext({LiveAPI,Task,Dict,outlet:(...args)=>outputs.push(args),post:message=>logs.push(message)});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../device/lom.js'),'utf8'),ctx);
 const flush=()=>{for(let pass=0;pass<10;pass++){const pending=tasks.filter(t=>t.pending);if(!pending.length)return;for(const task of pending){task.pending=false;task.fn();}}throw new Error('Task loop');};
 const changed=(p,prop)=>{for(const o of observers.filter(o=>o.id&&o.path===p&&o.property===prop))o.callback([prop,...[].concat(data[p][prop])]);flush();};
 return {ctx,data,outputs,calls,observers,tasks,dict,logs,gets,writes,flush,changed,get created(){return created;}};
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
test('poll catches loop edits and refresh cleans old observers',()=>{
 const h=harness();h.ctx.refresh();h.flush();const count=h.observers.filter(o=>o.id).length;
 h.data['live_set tracks 1 clip_slots 1 clip'].loop_end=68;h.ctx.rebuild();
 a.equal(JSON.parse(h.dict.scenes)[1].loopBeats,64);
 h.ctx.refresh();h.flush();a.equal(h.observers.filter(o=>o.id).length,count);
});
test('fire rereads Live names even when the snapshot is stale, with exact string matching',()=>{
 const h=harness();h.ctx.refresh();
 h.data['live_set scenes 1'].name='INSERTED';
 h.ctx.fire(1,'[N32] AA');h.ctx.fire(1);a.deepEqual(h.calls,[]);a.equal(h.logs.length,2);
 for(const name of ['', '  padded  ', 'A "quote" \\ tail', '42']) {
  h.data['live_set scenes 1'].name=name;h.ctx.fire(1,name);h.ctx.fire(1,name+' ');
 }
 a.equal(h.calls.length,4);a.equal(h.logs.length,6);
});
test('unchanged polling skips dict writes, scene metadata reads and scenes messages',()=>{
 const h=harness();h.ctx.refresh();const writes=h.writes.length;
 h.gets.length=0;h.outputs.length=0;
 const poll=h.tasks.find(t=>t.interval===5000);poll.fn();poll.fn();
 a.equal(h.writes.length,writes);a.equal(h.outputs.filter(o=>o[1]==='scenes').length,0);
 a.ok(!h.gets.some(([p])=>p.startsWith('live_set scenes ')));
 h.data['live_set tracks 1 clip_slots 1 clip'].loop_end=68;poll.fn();
 a.equal(h.writes.length,writes+1);a.equal(h.outputs.filter(o=>o[1]==='scenes').length,1);
 a.equal(JSON.parse(h.dict.scenes)[1].loopBeats,64);
 h.ctx.refresh();a.equal(h.writes.length,writes+2); // Node-ready refresh must resend.
});
test('unwarped audio has no beat timing; warped audio and MIDI retain timing',()=>{
 const h=harness(),clip=h.data['live_set tracks 1 clip_slots 1 clip'];
 clip.is_audio_clip=1;clip.warping=0;h.ctx.refresh();
 a.equal(JSON.parse(h.dict.scenes)[1].loopBeats,null);
 a.deepEqual(h.outputs.filter(o=>o[1]==='pos').at(-1),[0,'pos',1,0,0,0,4]);
 clip.warping=1;h.ctx.pollTiming();a.equal(JSON.parse(h.dict.scenes)[1].loopBeats,128);
 a.equal(h.outputs.filter(o=>o[1]==='pos').at(-1)[3],46);
 clip.is_audio_clip=0;clip.warping=0;h.ctx.pollTiming();a.equal(JSON.parse(h.dict.scenes)[1].loopBeats,128);
});
