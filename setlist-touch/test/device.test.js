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
 let fronts=0;
 const ctx=vm.createContext({Task,patcher:{wind,getnamed:()=>browser,front:()=>{fronts++;wind.visible=1;}}});
 vm.runInContext(fs.readFileSync(path.join(device,'touch-window.js'),'utf8'),ctx);
 ctx.bang();a.ok(tasks.every(t=>!t.running));
 ctx.showwindow();a.equal(wind.visible,1);a.equal(sizes.length,1);a.ok(tasks.at(-1).running);
 tasks.at(-1).fn();a.equal(sizes.length,1);
 wind.size=[900,700];tasks.at(-1).fn();a.equal(sizes.length,2);
 wind.visible=0;tasks.at(-1).fn();a.ok(tasks.every(t=>!t.running));
 ctx.showwindow();a.equal(fronts,2);a.equal(sizes.length,3);ctx.notifydeleted();a.ok(tasks.every(t=>!t.running));
});
test('Node for Max fire carries the name as an intact symbol, including empty names',async()=>{
 const outlets=[];let bridge;
 const max={outlet:(...args)=>outlets.push(args),addHandler:()=>{}};
 const req=name=>name==='max-api'?max:name==='./lib/app'?{createApp:options=>{bridge=options.bridge;return {listenWithFallback:()=>Promise.resolve(8765),getPortNote:()=>'',getConfig:()=>({port:8765})};}}:name==='./lib/config'?{loadConfig:()=>({})}:require(name);
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
 for(const [src,dst,outlet] of [['route','player-route',6],['player-route','timing-route',2],['timing-route','transport-route',1],['transport-route','transport-defer',0],['transport-defer','transport',0],['refresh','transport',0],['transport','node',0]])
  a.ok(p.lines.some(({patchline:l})=>l.source[0]===src&&l.source[1]===outlet&&l.destination[0]===dst));
 const files=['SetlistTouch.maxpat','SetlistTouch.amxd'],before=files.map(f=>fs.readFileSync(path.join(device,f)));
 require('child_process').execFileSync('python3',[path.join(device,'build_device.py')]);
 files.forEach((f,i)=>a.deepEqual(fs.readFileSync(path.join(device,f)),before[i]));
});
test('Node for Max passes transport selector/target and forwards observed state',async()=>{
 const outlets=[],handlers={};let bridge;
 const max={outlet:(...args)=>outlets.push(args),addHandler:(name,fn)=>handlers[name]=fn};
 const req=name=>name==='max-api'?max:name==='./lib/app'?{createApp:options=>{bridge=options.bridge;return {listenWithFallback:()=>Promise.resolve(8765),getPortNote:()=>'',getConfig:()=>({port:8765})};}}:name==='./lib/config'?{loadConfig:()=>({})}:require(name);
 const ctx=vm.createContext({require:req,process:{on:()=>{}}});vm.runInContext(fs.readFileSync(path.join(device,'setlist-server.js'),'utf8'),ctx);
 bridge.transport('play');bridge.transport('stop');bridge.transport('record',1);bridge.transport('record',0);
 a.deepEqual(outlets.filter(o=>o[0]==='transport'),[['transport','play'],['transport','stop'],['transport','record',1],['transport','record',0]]);
 let state;bridge.on('transport',v=>state=v);handlers.transport(1,0,120,3,6,8,'37.2.1.0');a.equal(state.beats_song_time,'37.2.1.0');a.equal(state.current_song_time,3);a.equal(state.signature_denominator,8);
 await Promise.resolve();
});

test('progress routes to device status and completion restores the latest address after the scenes Dict',async()=>{
 const p=JSON.parse(fs.readFileSync(path.join(device,'SetlistTouch.maxpat'))).patcher;
 const boxes=Object.fromEntries(p.boxes.map(({box})=>[box.id,box]));
 a.equal(boxes['index-status'].text,'sprintf Indexing scenes %ld / %ld…');
 for(const [src,dst,outlet] of [['route','index-status',5],['index-status','address-set',0],['address-set','address',0]])
  a.ok(p.lines.some(({patchline:l})=>l.source[0]===src&&l.source[1]===outlet&&l.destination[0]===dst));
 const outlets=[],handlers=[],events=[];let bridge,resolveDict;
 const max={outlet:(...args)=>outlets.push(args),addHandler:(name,fn)=>handlers[name]=fn,
  getDict:()=>new Promise(resolve=>resolveDict=resolve),post:()=>{}};
 const req=name=>name==='max-api'?max:name==='./lib/app'?{createApp:options=>{bridge=options.bridge;return {listenWithFallback:()=>Promise.resolve(8765),getPortNote:()=>'',getConfig:()=>({port:8765})};}}:name==='./lib/config'?{loadConfig:()=>({})}:require(name);
 vm.runInNewContext(fs.readFileSync(path.join(device,'setlist-server.js'),'utf8'),{require:req,process:{on:()=>{}}});
 await new Promise(r=>setImmediate(r));const address=outlets.find(o=>o[0]==='address')[1];
 bridge.on('progress',v=>events.push(['progress',v.done]));bridge.on('scenes',()=>events.push(['scenes']));
 handlers.progress(340,683);await new Promise(r=>setImmediate(r));
 a.deepEqual(outlets.at(-1),['progress',340,683]);
 bridge.addressChanged(5250);a.deepEqual(outlets.filter(o=>o[0]==='address').at(-1),['address',address]);
 handlers.scenes();handlers.progress(683,683);await new Promise(r=>setImmediate(r));
 a.equal(events.length,1);resolveDict({scenes:'[]'});await new Promise(r=>setImmediate(r));
 a.deepEqual(events,[['progress',340],['scenes'],['progress',683]]);
 a.ok(outlets.at(-1)[1].endsWith(':5250'));a.equal(outlets.at(-1)[0],'address');
});


test('Node ready uses distinct replay messages for all three lanes without triggering refresh',()=>{
 const p=JSON.parse(fs.readFileSync(path.join(device,'SetlistTouch.maxpat'))).patcher;
 const boxes=Object.fromEntries(p.boxes.map(({box})=>[box.id,box]));
 a.equal(boxes.ready.text,'ready');
 a.ok(p.lines.some(({patchline:l})=>l.source[0]==='route'&&l.source[1]===3&&l.destination[0]==='ready'));
 a.ok(!p.lines.some(({patchline:l})=>l.source[0]==='route'&&l.source[1]===3&&l.destination[0]==='refresh'));
 for(const lane of ['lom','mix','transport'])a.ok(p.lines.some(({patchline:l})=>l.source[0]==='ready'&&l.destination[0]===lane));
 a.ok(p.lines.some(({patchline:l})=>l.source[0]==='thisdevice'&&l.destination[0]==='refresh'));
});

test('player and effect commands are deferred and preserve selectors through independent lanes',()=>{
 const p=JSON.parse(fs.readFileSync(path.join(device,'SetlistTouch.maxpat'))).patcher;
 const boxes=Object.fromEntries(p.boxes.map(({box})=>[box.id,box]));a.equal(boxes.players.text,'js players.js');a.equal(boxes['player-defer'].text,'deferlow');a.equal(boxes['effect-defer'].text,'deferlow');
 for(const [src,dst,outlet] of [['route','player-route',6],['player-route','player-defer',0],['player-defer','players',0],['players','node',0],['refresh','players',0],['player-route','effect-defer',1],['effect-defer','effect-send',0],['effect-send','mix',0]])a.ok(p.lines.some(({patchline:l})=>l.source[0]===src&&l.source[1]===outlet&&l.destination[0]===dst));
 for(const file of ['mix.js','players.js']) { const source=fs.readFileSync(path.join(device,file),'utf8');a.doesNotMatch(source,/\b(?:const|let|class)\s|=>|`/);new vm.Script(source); }
});

test('timing commands route through deferlow into the budgeted LOM worker, ES5',()=>{
 const p=JSON.parse(fs.readFileSync(path.join(device,'SetlistTouch.maxpat'))).patcher;
 const boxes=Object.fromEntries(p.boxes.map(({box})=>[box.id,box]));
 a.equal(boxes['timing-route'].text,'route timing');a.equal(boxes['timing-defer'].text,'deferlow');
 for(const [src,dst] of [['timing-route','timing-defer'],['timing-defer','lom']])a.ok(p.lines.some(({patchline:l})=>l.source[0]===src&&l.destination[0]===dst));
 a.doesNotMatch(fs.readFileSync(path.join(device,'lom.js'),'utf8'),/\b(?:const|let|class)\s|=>|`/);
});

test('timing bridge forwards progress/status and request Dict result, forgets it and restores address',async()=>{
 const outlets=[],handlers={};let bridge;
 const max={outlet:(...args)=>outlets.push(args),addHandler:(name,fn)=>handlers[name]=fn,getDict:async()=>({result:JSON.stringify({ok:true,created:2,existing:1,noSource:0})})};
 const req=name=>name==='max-api'?max:name==='./lib/app'?{createApp:options=>{bridge=options.bridge;return {listenWithFallback:()=>Promise.resolve(8765),getPortNote:()=>'',getConfig:()=>({port:8765})};}}:name==='./lib/config'?{loadConfig:()=>({})}:require(name);
 vm.runInNewContext(fs.readFileSync(path.join(device,'setlist-server.js'),'utf8'),{require:req,process:{on:()=>{}},setTimeout,clearTimeout});
 await new Promise(r=>setImmediate(r));const address=outlets.find(o=>o[0]==='address')[1];
 const pending=bridge.buildTiming({confirmPlaying:true});a.deepEqual(outlets.at(-1),['timing','timingBuild',1,1]);
 a.equal((await bridge.buildTiming({})).ok,false);
 let progress;bridge.on('timingProgress',v=>progress=v);handlers.timingProgress(1,3);
 a.equal(progress.done,1);a.deepEqual(outlets.at(-1),['address','Building timing clips 1 / 3']);
 await handlers.timingResult(1);a.equal((await pending).created,2);
 a.ok(outlets.some(o=>o[0]==='timing'&&o[1]==='timingForget'&&o[2]===1));a.deepEqual(outlets.at(-1),['address',address]);
});

test('Open converts any button output to ordered pcontrol open then resize/front',()=>{
 const p=JSON.parse(fs.readFileSync(path.join(device,'SetlistTouch.maxpat'))).patcher;
 const boxes=Object.fromEntries(p.boxes.map(({box})=>[box.id,box]));
 const wired=(src,dst,outlet=0)=>p.lines.some(({patchline:l})=>l.source[0]===src&&l.source[1]===outlet&&l.destination[0]===dst&&l.destination[1]===0);
 a.equal(boxes['select-open'].text,'t b b');a.equal(boxes['pcontrol-open'].text,'open');a.equal(boxes.pcontrol.text,'pcontrol');
 for(const [src,dst,outlet] of [['open','select-open',0],['select-open','pcontrol-open',1],['pcontrol-open','pcontrol',0],['pcontrol','window',0],['select-open','open-message',0],['open-message','window',0]])a.ok(wired(src,dst,outlet));
 a.ok(boxes.address.presentation_rect[3]>=100);
 a.doesNotMatch(fs.readFileSync(path.join(device,'touch-window.js'),'utf8'),/\b(?:const|let|class)\s|=>|`/);
});
test('startup fallback note and failure reach the panel; ready only follows success',async()=>{
 for(const failed of [false,true]) {
  const outlets=[],handlers={};
  const note='Port 8765 was busy — now on 8766';
  const error='Ports 8765–8784 are busy. Close the other program or set "port" in config.json, then reload the device.';
  const max={outlet:(...args)=>outlets.push(args),addHandler:(name,fn)=>handlers[name]=fn,post:()=>{}};
  const req=name=>name==='max-api'?max:name==='./lib/app'?{createApp:()=>({listenWithFallback:()=>failed?Promise.reject(Error(error)):Promise.resolve(8766),getConfig:()=>({port:8765}),getPortNote:()=>note})}:name==='./lib/config'?{loadConfig:()=>({})}:require(name);
  vm.runInNewContext(fs.readFileSync(path.join(device,'setlist-server.js'),'utf8'),{require:req,process:{on:()=>{}}});
  await new Promise(r=>setImmediate(r));
  const text=outlets.find(o=>o[0]==='address')[1];
  if(failed) {a.equal(text,error);a.ok(!outlets.some(o=>o[0]==='ready'));
   handlers.progress(1,100);await new Promise(r=>setImmediate(r));a.deepEqual(outlets.at(-1),['address',error]);}
  else {a.ok(text.startsWith(note+'\n'));a.match(text,/:8766$/);a.ok(outlets.some(o=>o[0]==='ready'));a.deepEqual(outlets.find(o=>o[0]==='url'),['url','http://127.0.0.1:8766/']);}
 }
});
