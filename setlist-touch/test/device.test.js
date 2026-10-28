const {test}=require('node:test');
const a=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const device=path.join(__dirname,'../device');
test('AMXD reference header, chunk length, JSON and LF/NUL terminator match the patch',()=>{
 const file=fs.readFileSync(path.join(device,'SetlistTouch.amxd'));
 a.deepEqual(file.subarray(0,28),Buffer.from('616d7066040000006d6d6d6d6d657461040000000000000070746368','hex'));
 a.equal(file.readUInt32LE(28),file.length-32);
 a.deepEqual(file.subarray(-2),Buffer.from([10,0]));
 const json=file.subarray(32,-2);a.deepEqual(json,fs.readFileSync(path.join(device,'SetlistTouch.maxpat')));
 a.ok(JSON.parse(json).patcher);
});
test('patch preserves index/name through deferlow and routes window open to the resize helper',()=>{
 const p=JSON.parse(fs.readFileSync(path.join(device,'SetlistTouch.maxpat'))).patcher;
 const boxes=Object.fromEntries(p.boxes.map(({box})=>[box.id,box]));
 const wired=(patch,src,dst,outlet=0)=>patch.lines.some(({patchline:l})=>l.source[0]===src&&l.source[1]===outlet&&l.destination[0]===dst);
 for(const [src,dst] of [['node','route'],['route','defer'],['defer','fire'],['fire','lom'],['open-message','window']])a.ok(wired(p,src,dst));
 a.equal(boxes.defer.text,'deferlow');a.equal(boxes.fire.text,'prepend fire');
 a.equal(boxes['open-message'].text,'showwindow');
 a.ok(wired(boxes.window.patcher,'control-in','window-js'));
});
test('resize task sleeps while closed, resumes on open and writes only changed geometry',()=>{
 const tasks=[],sizes=[],browser={setboxattr:(key,size)=>sizes.push([key,size])};
 const wind={visible:0,size:[1200,800]};
 function Task(fn,ctx){this.fn=fn.bind(ctx);this.repeat=()=>this.running=true;this.cancel=()=>this.running=false;tasks.push(this);}
 const ctx=vm.createContext({Task,patcher:{wind,getnamed:()=>browser}});
 vm.runInContext(fs.readFileSync(path.join(device,'touch-window.js'),'utf8'),ctx);
 ctx.bang();a.ok(tasks.every(t=>!t.running));
 ctx.showwindow();a.equal(wind.visible,1);a.equal(sizes.length,1);a.ok(tasks.at(-1).running);
 tasks.at(-1).fn();a.equal(sizes.length,1);
 wind.size=[900,700];tasks.at(-1).fn();a.equal(sizes.length,2);
 wind.visible=0;tasks.at(-1).fn();a.ok(tasks.every(t=>!t.running));
 ctx.showwindow();a.equal(sizes.length,3);ctx.notifydeleted();a.ok(tasks.every(t=>!t.running));
});
test('Node for Max fire carries the name as an intact symbol, including empty names',async()=>{
 const outlets=[];let bridge;
 const max={outlet:(...args)=>outlets.push(args),addHandler:()=>{}};
 const req=name=>name==='max-api'?max:name==='./lib/app'?{createApp:options=>{bridge=options.bridge;return {listen:()=>Promise.resolve(8765),getConfig:()=>({port:8765})};}}:name==='./lib/config'?{loadConfig:()=>({})}:require(name);
 const ctx=vm.createContext({require:req,process:{on:()=>{}}});
 vm.runInContext(fs.readFileSync(path.join(device,'setlist-server.js'),'utf8'),ctx);
 for(const name of ['','[N32] AA','  padded "name"  '])bridge.fire(1,name);
 a.deepEqual(outlets.filter(o=>o[0]==='fire'),[['fire',1,''],['fire',1,'[N32] AA'],['fire',1,'  padded "name"  ']]);
 await Promise.resolve();
});

test('transport commands use deferlow and refresh/Node wiring; generator is deterministic',()=>{
 const p=JSON.parse(fs.readFileSync(path.join(device,'SetlistTouch.maxpat'))).patcher;
 const boxes=Object.fromEntries(p.boxes.map(({box})=>[box.id,box]));
 a.equal(boxes['transport-route'].text,'route transport');a.equal(boxes['transport-defer'].text,'deferlow');a.equal(boxes.transport.text,'js transport.js');
 for(const [src,dst,outlet] of [['route','transport-route',5],['transport-route','transport-defer',0],['transport-defer','transport',0],['refresh','transport',0],['transport','node',0]])
  a.ok(p.lines.some(({patchline:l})=>l.source[0]===src&&l.source[1]===outlet&&l.destination[0]===dst));
 const files=['SetlistTouch.maxpat','SetlistTouch.amxd'],before=files.map(f=>fs.readFileSync(path.join(device,f)));
 require('child_process').execFileSync('python3',[path.join(device,'build_device.py')]);
 files.forEach((f,i)=>a.deepEqual(fs.readFileSync(path.join(device,f)),before[i]));
});
test('Node for Max passes transport selector/target and forwards observed state',async()=>{
 const outlets=[],handlers={};let bridge;
 const max={outlet:(...args)=>outlets.push(args),addHandler:(name,fn)=>handlers[name]=fn};
 const req=name=>name==='max-api'?max:name==='./lib/app'?{createApp:options=>{bridge=options.bridge;return {listen:()=>Promise.resolve(8765),getConfig:()=>({port:8765})};}}:name==='./lib/config'?{loadConfig:()=>({})}:require(name);
 const ctx=vm.createContext({require:req,process:{on:()=>{}}});vm.runInContext(fs.readFileSync(path.join(device,'setlist-server.js'),'utf8'),ctx);
 bridge.transport('play');bridge.transport('stop');bridge.transport('record',1);bridge.transport('record',0);
 a.deepEqual(outlets.filter(o=>o[0]==='transport'),[['transport','play'],['transport','stop'],['transport','record',1],['transport','record',0]]);
 let state;bridge.on('transport',v=>state=v);handlers.transport(1,0,120,3,6,8,'37.2.1.0');a.equal(state.beats_song_time,'37.2.1.0');a.equal(state.current_song_time,3);a.equal(state.signature_denominator,8);
 await Promise.resolve();
});
