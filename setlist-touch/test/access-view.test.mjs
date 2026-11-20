import {noSongsMessage} from '../device/web/js/timing-view.js';
import {test} from 'node:test';import a from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../device/web/js/access-view.js',import.meta.url),'utf8');
const {allowedPages,pageFor,allowedTabs,showPicker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const member={kind:'member',pages:['monitor'],mixes:['Alex']};
test('access off has all pages and no picker',()=>{a.deepEqual(allowedPages({kind:'open'}),['scenes','mix','monitor']);a.equal(showPicker({kind:'open'}),false);});
test('permission changes move revoked pages and filter renamed mix tabs immediately',()=>{
 a.equal(pageFor('scenes',member),'mix');a.deepEqual(allowedTabs({returns:[{name:'Alex'},{name:'Other'}]},member),[{name:'Alex'}]);
 const revoked={...member,mixes:[]};a.equal(pageFor('mix',revoked),'monitor');a.deepEqual(allowedTabs({returns:[{name:'Renamed'}]},member),[]);
 a.deepEqual(allowedPages({...revoked,pages:['transport']}),['monitor']);
 const removed={kind:'none',pages:['monitor'],mixes:[]};a.equal(showPicker(removed),true);a.equal(pageFor('scenes',removed),'monitor');
 a.equal(pageFor('scenes',{kind:'admin'}),'scenes');
});

test('orphaned mix permissions fall back to Monitor once the return snapshot is known',()=>{
 a.equal(pageFor('mix',member,{returns:[{name:'Renamed'}]}),'monitor');
 a.deepEqual(allowedPages(member,{returns:[{name:'Renamed'}]}),['monitor']);
});

// Run the real app shell with controlled network ordering, not a copy of its reducer.
import vm from 'node:vm';
import * as sceneView from '../device/web/js/scene-window.js';
import * as monitorView from '../device/web/js/monitor-view.js';
import * as viewState from '../device/web/js/view-state.js';
import * as mixView from '../device/web/js/mix-view.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function shellHarness({local=false,prefs={page:'mix',tab:'Keith'},config={},apiStatus=200}={}) {
 const nodes=new Map(), pending=[], posts=[], storage=[], counters={cancel:0,render:0};
 function target() {const handlers=new Map();return {addEventListener(type,fn){handlers.set(type,fn);},emit(type,event={}){return handlers.get(type)?.(event);}};}
 function node() {return {...target(),hidden:false,textContent:'',dataset:{},style:{},setAttribute(){},classList:{add(){},remove(){}}};}
 const get=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
 const form=get('.settings-form');form.elements=Object.fromEntries(['port','username','password','adminPassword','accessEnabled','allowOpenLan'].map(key=>[key,{name:key,value:key==='port'?'5290':key==='username'?'band':'',checked:false}]));
 const sceneForm=get('.admin-scene-settings');sceneForm.contains=()=>false;sceneForm.elements={sceneBefore:{value:2},sceneAfter:{value:2}};
 const location={hostname:local?'localhost':'127.0.0.2',hash:'',search:'',port:'5290'};
 const document={...target(),querySelector:get,querySelectorAll:()=>[],body:{dataset:{}}};
 const full={kind:local?'admin':'open',accessEnabled:false,pages:['monitor','scenes','transport'],mixes:'all',members:[]};
 const events=target();
 const ctx={...sceneView,...monitorView,renderSceneWindow(){},noSongsMessage,...viewState,...mixView,document,location,window:target(),URLSearchParams,ResizeObserver:class{observe(){}},
  localStorage:{getItem:()=>JSON.stringify(prefs),setItem:(k,v)=>storage.push(JSON.parse(v))},
  setTimeout:()=>0,clearTimeout(){},render(){},updatePlayback(){},fitSceneRows(){},
  createTapDetector:()=>({move(){}}),createTransportRenderer:()=>({syncAvailability(){},cancel(){},reset(){}}),
  createMixRenderer:()=>({cancel(){counters.cancel++;},render(){counters.render++;},syncAvailability(){},updateLevels(){}}),
  EventSource:class {constructor(){return events;}},
  importModule:async name=>name.includes('access-view')?{allowedPages,pageFor,allowedTabs,showPicker}:name.includes('access-render')?{createAccessRenderer:()=>({render(){},invalidate(){}})}:{createMonitorRenderer:()=>({render(){},setActive(){}})},
  fetch:(url,options)=>{
   if(url==='/api/me')return new Promise(resolve=>pending.push(me=>resolve({ok:true,json:async()=>me})));
   if(options){posts.push(JSON.parse(options.body));return Promise.resolve({ok:apiStatus<400,status:apiStatus});}
   return Promise.resolve({ok:true,json:async()=>({port:5290,username:'band',hasPassword:true,accessEnabled:false,...config})});
  }};
 ctx.window.fetch=ctx.fetch;
 const app=fs.readFileSync(new URL('../device/web/js/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('import(', 'importModule(');
 vm.runInNewContext(app+'\nglobalThis.hooks={shell,dispatch,acceptMix,refreshMe,settings,get me(){return me;},get tab(){return mixState.tab;},get page(){return state.page;}};',ctx);
 return {events,ctx,get,form,location,pending,posts,storage,counters,full,hooks:ctx.hooks};
}
const returns={returns:[{name:'Shaun'},{name:'Keith'}],strips:[]};
for(const restricted of [false,true]) test(`mix before identity preserves saved tab with access ${restricted?'on':'off'}`,async()=>{
 const h=shellHarness();await flush();h.hooks.acceptMix(returns);
 a.equal(h.hooks.tab,'Keith');a.ok(h.storage.every(p=>p.tab==='Keith'));
 h.pending.shift()({...h.full,kind:restricted?'member':'open',accessEnabled:restricted,mixes:restricted?['Shaun','Keith']:'all'});await flush();
 a.equal(h.hooks.tab,'Keith');a.equal(h.storage.at(-1).tab,'Keith');
});
test('stale laptop settings refresh restrictions and omit untouched switch from a settings save',async()=>{
 const h=shellHarness({local:true});await flush();h.pending.shift()(h.full);await flush();
 h.location.hash='#settings';await h.hooks.settings();a.equal(h.form.elements.accessEnabled.checked,false);a.equal(h.get('.settings-config-warning').hidden,true);
 const refresh=h.hooks.refreshMe();await flush();h.pending.shift()({...h.full,accessEnabled:true});await refresh;
 a.equal(h.form.elements.accessEnabled.checked,true);
 await h.form.emit('submit',{preventDefault(){},currentTarget:h.form});a.ok(!('accessEnabled' in h.posts.at(-1)));
 h.form.elements.accessEnabled.checked=false;h.form.emit('change',{target:h.form.elements.accessEnabled});
 await h.form.emit('submit',{preventDefault(){},currentTarget:h.form});a.equal(h.posts.at(-1).accessEnabled,false);
});
test('refresh ignores an older response and unrelated edits do not cancel a fader gesture',async()=>{
 const h=shellHarness();await flush();h.hooks.acceptMix(returns);h.pending.shift()(h.full);await flush();
 const before={...h.counters};const unchanged=h.hooks.refreshMe();await flush();h.pending.shift()({...h.full,members:[{id:'other',name:'Other'}]});await unchanged;
 a.deepEqual(h.counters,before);
 const older=h.hooks.refreshMe(),newer=h.hooks.refreshMe();await flush();
 h.pending[1]({...h.full,kind:'none',pages:['monitor'],mixes:[],accessEnabled:true});await newer;
 h.pending[0](h.full);await older;
 a.equal(h.hooks.me.kind,'none');a.equal(h.hooks.page,'monitor');a.ok(h.counters.cancel>before.cancel);
});

const mixMember={kind:'member',accessEnabled:true,pages:['monitor','scenes'],mixes:['Keith'],members:[]};
test('shell keeps My mix and its preference through an empty server-restart snapshot',async()=>{
 const h=shellHarness();await flush();h.pending.shift()(mixMember);await flush();
 a.equal(h.hooks.page,'mix');a.equal(h.storage.at(-1).page,'mix');
 h.events.emit('open');await flush();
 h.hooks.acceptMix({returns:[],strips:[]});
 a.equal(h.hooks.page,'mix');a.equal(h.storage.at(-1).page,'mix');
 a.equal(h.get('.connection-bar').hidden,false);a.equal(h.get('.connection-label').textContent,'Waiting for Live set…');
 for(const resolve of h.pending.splice(0))resolve(mixMember);await flush();
 h.hooks.dispatch({type:'connected',value:true});
 a.equal(h.hooks.page,'mix');a.equal(h.storage.at(-1).page,'mix');
 h.hooks.acceptMix(returns);
 a.equal(h.hooks.page,'mix');a.equal(h.storage.at(-1).page,'mix');a.equal(h.hooks.tab,'Keith');a.equal(h.get('.connection-bar').hidden,true);
});
test('identity before mix leaves the saved tab untouched until the snapshot arrives',async()=>{
 const h=shellHarness();await flush();h.pending.shift()({...mixMember,mixes:['Shaun','Keith']});await flush();
 a.equal(h.hooks.tab,'Keith');a.equal(h.storage.at(-1).tab,'Keith');
 h.hooks.acceptMix(returns);a.equal(h.hooks.tab,'Keith');a.equal(h.storage.at(-1).tab,'Keith');
});
test('shell applies current returns when an orphaned permission removes the Mix page',async()=>{
 const h=shellHarness();await flush();h.pending.shift()(mixMember);await flush();a.equal(h.hooks.page,'mix');
 // No identity refresh here: only acceptMix -> shell can change this page.
 h.hooks.acceptMix({returns:[{name:'Renamed'}],strips:[]});
 a.equal(h.hooks.page,'scenes');a.equal(h.ctx.document.body.dataset.page,'scenes');
 h.hooks.dispatch({type:'connected',value:true});a.equal(h.storage.at(-1).page,'scenes');
});
test('shell waits for an allowed return, even when an unfiltered snapshot has returns',async()=>{
 const h=shellHarness();await flush();h.events.emit('open');await flush();
 h.hooks.acceptMix(returns);
 a.equal(h.hooks.page,'mix');a.equal(h.get('.connection-bar').hidden,false);
 a.equal(h.get('.connection-label').textContent,'Waiting for Live set…');
 for(const resolve of h.pending.splice(0))resolve(mixMember);await flush();
 a.equal(h.get('.connection-bar').hidden,true);
});
for(const backupAvailable of [true,false])test(`laptop Settings warns about damaged config with recovery copy ${backupAvailable?'available':'unavailable'}`,async()=>{
 const h=shellHarness({local:true,config:{configWarning:{backupAvailable}}});await flush();
 h.location.hash='#settings';await h.hooks.settings();
 const warning=h.get('.settings-config-warning');a.equal(warning.hidden,false);a.match(warning.textContent,/missing members and passwords/);
 a.match(warning.textContent,backupAvailable?/config.json.damaged/:/Could not create a recovery copy/);
});

test('real app shows received-empty message only after index and hides it again on reconnect',async()=>{
 const h=shellHarness({local:true});
 h.events.emit('open');a.equal(h.get('.connection-label').textContent,'Waiting for Live set…');
 h.events.emit('progress',{data:JSON.stringify({done:0,total:683})});
 h.events.emit('set',{data:JSON.stringify({songs:[],categories:[],sceneToSong:{}})});
 a.equal(h.get('.connection-label').hidden,true);
 h.events.emit('progress',{data:JSON.stringify({done:683,total:683})});
 a.equal(h.get('.connection-label').textContent,'No songs found. Name a scene "* Song title".');a.equal(h.get('.connection-label').hidden,false);
 h.events.emit('error');a.equal(h.get('.connection-label').textContent,'Reconnecting…');
 h.events.emit('open');a.equal(h.get('.connection-label').textContent,'Waiting for Live set…');
});
test('cancelled timing confirmation makes no POST and admin controls stay hidden for phones',async()=>{
 const h=shellHarness({local:true});h.ctx.confirm=()=>false;
 await h.get('.timing-build').onclick();a.equal(h.posts.length,0);
 const phone=shellHarness();phone.location.hash='#admin';phone.hooks.shell();a.equal(phone.get('.timing-panel').hidden,true);
});


test('timing form displays fallback refusal and nonfatal name warnings from result events',()=>{
 const h=shellHarness({local:true});
 h.events.emit('timing',{data:JSON.stringify({running:false,ok:false,message:'Timing clips need the device on its own MIDI track. Build refused.'})});
 a.match(h.get('.timing-status').textContent,/own MIDI track/);
 h.events.emit('timing',{data:JSON.stringify({running:false,ok:true,created:3,existing:0,noSource:0,unnamed:2})});
 a.match(h.get('.timing-status').textContent,/Build complete/);a.match(h.get('.timing-status').textContent,/Warning: 2 clip name/);
});

for (const kind of ['admin','open']) test(`${kind} picker is optional even with access enabled`,()=>{
 const me={kind,accessEnabled:true,name:null,members:[{name:'Alex'}]};
 a.equal(showPicker(me,false),true);a.equal(showPicker(me,true),false);
});
test('none picker is required despite prior dismissal',()=>{
 a.equal(showPicker({kind:'none',accessEnabled:true,name:null,members:[]},true),true);
 a.equal(showPicker({kind:'member',accessEnabled:true,name:'Alex'}),false);
});
for(const apiStatus of [200,403])test(`API ${apiStatus} ${apiStatus===403?'refreshes':'does not refresh'} identity`,async()=>{
 const h=shellHarness({apiStatus});await flush();h.pending.shift()({...mixMember,name:'Keith'});await flush();
 const request=h.ctx.window.fetch('/api/send',{method:'POST',body:'{}'});await flush();
 a.equal(h.pending.length,apiStatus===403?1:0);
 if(apiStatus===403)h.pending.shift()({...mixMember,kind:'none',name:null,mixes:[]});
 await request;if(apiStatus===403)a.equal(h.hooks.me.kind,'none');
});

test('Monitor launch uses the drawn name even when the current set has renamed it',async()=>{
 let onLaunch;
 const source=fs.readFileSync(new URL('../device/web/js/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('import(', 'importModule(');
 // Capture the real callback directly from the module's lazy-loader setup.
 const callback=source.slice(source.indexOf('    monitorUI = createMonitorRenderer'),source.indexOf('    }}); shell();')+8);
 const row={dataset:{sceneIndex:'23',name:'Drawn title'}};let launched;
 vm.runInNewContext(callback,{createMonitorRenderer:opts=>{onLaunch=opts.onLaunch;},document:{querySelector:()=>row},monitorSongs:[{rows:[{sceneIndex:23,name:'Renamed title'}]}],launch:r=>{launched=r.dataset.name;}});
 onLaunch(23);a.equal(launched,'Drawn title');
});

test('X32 members can reach mix page with no assigned or available bus; none identity cannot',()=>{
 a.ok(allowedPages({...member,mixes:[],mixSource:'x32',buses:[]},{returns:[]}).includes('mix'));
 a.ok(!allowedPages({kind:'none',pages:['monitor'],mixes:[],mixSource:'x32',buses:[]},{returns:[]}).includes('mix'));
});
