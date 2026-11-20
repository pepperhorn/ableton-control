import {test} from 'node:test';
import a from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as view from '../device/web/js/x32-view.js';
import {createVerticalFaderGesture} from '../device/web/js/fader.js';
import {createFaderHolds} from '../device/web/js/mix-view.js';
function harness() {
  function node(tag='div',cls='') {
    const n={tag,className:cls,children:[],dataset:{},attrs:{},textContent:'',style:{setProperty(){}},clientHeight:200,
      setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},append(...ns){for(const c of ns){this.children.push(c);c.parent=this;}},replaceChildren(){this.children=[];},addEventListener(){},setPointerCapture(){},
      matches(s){if(s.startsWith('[data-source='))return this.dataset.source===s.slice(14,-2);return s.startsWith('.') && this.className.split(' ').includes(s.slice(1));},
      querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);},querySelector(s){return this.querySelectorAll(s)[0] || null;},closest(s){return this.matches(s)?this:this.parent?.closest(s) || null;}};
    n.classList={contains:c=>n.className.split(' ').includes(c),add:c=>{n.className+=' '+c;},toggle(c,on){if(on && !this.contains(c))this.add(c);}};return n;
  }
  const root=node(),tabs=node('nav','send-tabs'),list=node('div','mix-list'),hint=node('p','mix-hint');root.append(tabs,list,hint);
  const listeners={},timers=new Map(),sent=[];let timerId=0;
  const document={createElement:tag=>node(tag),querySelector:s=>root.querySelector(s),querySelectorAll:s=>root.querySelectorAll(s),addEventListener(k,f){listeners[k]=f;}};
  const state={mixSource:'x32',status:{state:'connected'},buses:[{bus:5,master:0.5}],sources:[],levels:{},hidden:{}};
  const shell={locked:false,connected:true};
  const ctx={...view,createVerticalFaderGesture,createFaderHolds,document,window:{addEventListener(){}},location:{hash:''},performance:{now:()=>100},setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},fetch:async(url,opts)=>{sent.push(JSON.parse(opts.body));return {ok:true};}};
  let source=fs.readFileSync(new URL('../device/web/js/x32-render.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function','function');
  vm.runInNewContext(source+'\nglobalThis.create=createX32Renderer;',ctx);
  const ui=ctx.create({x32Of:()=>state,stateOf:()=>shell,viewOf:()=>({page:'mix'}),meOf:()=>({name:'Shaun'}),status(){}});ui.render();
  function event(type,x,y){const slider=list.querySelector('.mix-strip-fader');listeners[type]({pointerId:1,button:0,target:slider,clientX:x,clientY:y});}
  return {state,shell,ui,list,tabs,sent,event,flush:async()=>{for(const [id,fn] of [...timers]){timers.delete(id);await fn();}}};
}
test('desk loss mid-drag cancels queued write and release; reconnect sends nothing',async()=>{
  const h=harness();h.event('pointerdown',0,100);h.event('pointermove',0,50);h.state.status.state='lost';h.ui.render();h.event('pointerup',0,50);await h.flush();a.equal(h.sent.length,0);a.equal(h.list.querySelector('.mix-strip-fader').getAttribute('aria-disabled'),'true');a.equal(h.list.querySelector('.mix-x32-overlay').textContent,'X32 not connected');h.state.status.state='connected';h.ui.render();await h.flush();a.equal(h.sent.length,0);
});
test('renderer sends vertical relative drag, refuses tap, horizontal and locked gestures',async()=>{
  const h=harness();for(const [x,y] of [[2,102],[40,102]]){h.event('pointerdown',0,100);h.event('pointermove',x,y);h.event('pointerup',x,y);await h.flush();}a.equal(h.sent.length,0);
  h.event('pointerdown',0,100);h.event('pointermove',0,50);h.event('pointerup',0,50);await h.flush();a.deepEqual(h.sent,[{bus:5,source:'master',value:0.75}]);
  h.shell.locked=true;h.ui.syncAvailability();h.event('pointerdown',0,100);h.event('pointermove',0,0);h.event('pointerup',0,0);await h.flush();a.equal(h.sent.length,1);
});


test('lost member bus keeps neutral tab and disconnected overlay; unavailable applies only when connected',()=>{
  const h=harness();h.state.buses=[];h.state.unavailableBuses=[5];
  for(const state of ['lost','searching']) {
    h.state.status.state=state;h.ui.render();
    a.equal(h.tabs.children[0].textContent,'Bus 5');
    a.equal(h.list.querySelector('.mix-x32-overlay').textContent,state==='lost'?'X32 not connected':'Searching for X32…');
    a.equal(h.list.querySelectorAll('.mix-strip').length,0);
  }
  h.state.status.state='connected';h.ui.render();a.equal(h.tabs.children[0].textContent,'Bus 5 not available');a.equal(h.list.querySelector('.mix-x32-overlay').textContent,'Bus 5 not available');
});
