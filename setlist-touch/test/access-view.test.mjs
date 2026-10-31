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
import * as viewState from '../device/web/js/view-state.js';
import * as mixView from '../device/web/js/mix-view.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function shellHarness({local=false,prefs={page:'mix',tab:'Keith'},config={}}={}) {
 const nodes=new Map(), pending=[], posts=[], storage=[], counters={cancel:0,render:0};
 function target() {const handlers=new Map();return {addEventListener(type,fn){handlers.set(type,fn);},emit(type,event={}){return handlers.get(type)?.(event);}};}
 function node() {return {...target(),hidden:false,textContent:'',dataset:{},style:{},setAttribute(){},classList:{add(){},remove(){}}};}
 const get=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
 const form=get('.settings-form');form.elements=Object.fromEntries(['port','username','password','adminPassword','accessEnabled'].map(key=>[key,{name:key,value:key==='port'?'5290':key==='username'?'band':'',checked:false}]));
 const location={hostname:local?'localhost':'127.0.0.2',hash:'',search:'',port:'5290'};
 const document={...target(),querySelector:get,querySelectorAll:()=>[],body:{dataset:{}}};
 const full={kind:local?'admin':'open',accessEnabled:false,pages:['monitor','scenes','transport'],mixes:'all',members:[]};
 const events=target();
 const ctx={...viewState,...mixView,document,location,window:target(),URLSearchParams,ResizeObserver:class{observe(){}},
  localStorage:{getItem:()=>JSON.stringify(prefs),setItem:(k,v)=>storage.push(JSON.parse(v))},
  setTimeout:()=>0,clearTimeout(){},render(){},updatePlayback(){},fitSceneRows(){},
  createTapDetector:()=>({move(){}}),createTransportRenderer:()=>({syncAvailability(){},cancel(){},reset(){}}),
  createMixRenderer:()=>({cancel(){counters.cancel++;},render(){counters.render++;},syncAvailability(){},updateLevels(){}}),
  EventSource:class {constructor(){return events;}},
  importModule:async name=>name.includes('access-view')?{allowedPages,pageFor,allowedTabs,showPicker}:name.includes('access-render')?{createAccessRenderer:()=>({render(){},invalidate(){}})}:{createMonitorRenderer:()=>({render(){},setActive(){}})},
  fetch:(url,options)=>{
   if(url==='/api/me')return new Promise(resolve=>pending.push(me=>resolve({ok:true,json:async()=>me})));
   if(options){posts.push(JSON.parse(options.body));return Promise.resolve({ok:true});}
   return Promise.resolve({ok:true,json:async()=>({port:5290,username:'band',hasPassword:true,accessEnabled:false,...config})});
  }};
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
