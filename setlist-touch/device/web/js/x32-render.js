import {x32Strips,x32Tabs,x32Message,x32Db,deskPalette} from './x32-view.js';
import {createVerticalFaderGesture} from './fader.js';
import {createFaderHolds} from './mix-view.js';
const $=s=>document.querySelector(s);
function el(tag,cls,text) {const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;}
export function createX32Renderer({x32Of,stateOf,viewOf,meOf,status}) {
  let bus=null,drag=null,gesture=null,generation=0;
  const pointers=new Set(),lanes=new Map();
  const holds=createFaderHolds({onExpire:()=>updateLevels()});
  const key=s=>`${bus}:${s}`;
  const usable=()=>!stateOf().locked && stateOf().connected && viewOf().page==='mix' && !['#admin','#settings'].includes(location.hash) && x32Of().mixSource==='x32' && x32Of().status?.state==='connected';
  function paint(row,level) {
    row.querySelector('.mix-strip-fill').style.height=`${level.value*100}%`;
    row.querySelector('.mix-strip-thumb').style.bottom=`${level.value*100}%`;
    row.querySelector('.mix-strip-db').textContent=level.db || level.label || x32Db(level.value);
    const slider=row.querySelector('.mix-strip-fader');slider.setAttribute('aria-valuenow',String(Math.round(level.value*100)));slider.setAttribute('aria-valuetext',level.db || level.label || x32Db(level.value));
  }
  function updateLevels(echo) {
    if(echo) holds.echo(`${echo.bus}:${echo.source}`);
    for(const s of x32Strips(x32Of(),bus)) {const row=$(`.mix-strip[data-source="${s.source}"]`);if(row)paint(row,drag?.source===s.source ? drag.level : holds.get(key(s.source)) || s);}
  }
  function cancel() {
    generation++;gesture?.cancel();gesture=null;drag=null;holds.clear();
    for(const lane of lanes.values()){clearTimeout(lane.timer);lane.pending=null;} lanes.clear(); updateLevels();
  }
  function send(source,value) {
    if(!usable())return;
    const k=key(source); let lane=lanes.get(k);
    if(!lane){lane={last:0,inFlight:false};lanes.set(k,lane);}
    lane.pending={bus,source,value};const version=generation;
    const flush=async()=>{
      lane.timer=null;if(!lane.pending || lane.inFlight || !usable() || version!==generation)return;
      const command=lane.pending;lane.pending=null;lane.inFlight=true;lane.last=performance.now();
      try {const res=await fetch('/api/x32-send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command)});if(!res.ok && version===generation){cancel();status('Could not change X32 mix. Check the connection.');}}
      catch(_){if(version===generation){cancel();status('Could not change X32 mix. Check the connection.');}}
      finally{lane.inFlight=false;if(lane.pending && version===generation)lane.timer=setTimeout(flush,Math.max(0,50-(performance.now()-lane.last)));}
    };
    if(!lane.inFlight){clearTimeout(lane.timer);lane.timer=setTimeout(flush,Math.max(0,50-(performance.now()-lane.last)));}
  }
  function render() {
    cancel();const state=x32Of(),tabs=$('.send-tabs'),list=$('.mix-list');tabs.replaceChildren();list.replaceChildren();list.classList.add('mix-strips');
    $('.mix-hint').textContent='Slide up/down to adjust · swipe sideways to browse';
    const buses=x32Tabs(state);if(!buses.some(b=>b.bus===bus) && !(state.unavailableBuses || []).includes(bus))bus=buses[0]?.bus || state.unavailableBuses?.[0] || null;
    for(const b of [...buses,...(state.unavailableBuses || []).map(bus=>({bus,name:`Bus ${bus}${state.status?.state==='connected' ? ' not available' : ''}`}))]) {
      const tab=el('button','send-tab'+(b.bus===bus?' is-active':''),b.name || `Bus ${b.bus}`);tab.type='button';tab.setAttribute('aria-pressed',String(b.bus===bus));tab.onclick=()=>{bus=b.bus;render();};tabs.append(tab);
    }
    const message=x32Message(state,bus);
    if(message){const overlay=el('p','mix-x32-overlay',message);overlay.setAttribute('role','status');list.append(overlay);}
    for(const s of x32Strips(state,bus)) {
      const row=el('div','mix-strip'+(s.sticky?' mix-strip-master':'')+(s.hidden?' mix-strip-hidden':''));row.dataset.source=s.source;
      const c=Number(s.color)||0;row.style.setProperty('--strip-color',deskPalette[c%8]);row.classList.toggle('mix-strip-inverted',c>=8);
      const name=el('div','mix-strip-name',s.label),slider=el('div','mix-strip-fader');slider.setAttribute('role','slider');slider.setAttribute('aria-label',s.label);slider.setAttribute('aria-valuemin','0');slider.setAttribute('aria-valuemax','100');slider.setAttribute('aria-orientation','vertical');
      slider.append(el('span','mix-strip-fill'),el('span','mix-strip-thumb'));row.append(name,slider,el('span','mix-strip-db'));
      if(s.source!=='master') {const toggle=el('button','mix-strip-toggle',s.hidden?'Show':'Hide');toggle.type='button';toggle.disabled=!meOf().name || s.disabled;toggle.onclick=async()=>{
        const hidden=x32Strips(x32Of(),bus).filter(v=>v.hidden && v.source!=='master').map(v=>v.source).filter(v=>v!==s.source);if(!s.hidden)hidden.push(s.source);
        try{const res=await fetch('/api/x32-hidden',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({bus,hidden})});if(!res.ok)throw Error();}catch(_){status('Could not save hidden strips. Choose your name and check the connection.');}
      };row.append(toggle);} else {const spacer=el('span','mix-strip-master-spacer');spacer.setAttribute('aria-hidden','true');row.append(spacer);}
      list.append(row);paint(row,s);
    }
    syncAvailability();
  }
  function syncAvailability() {for(const row of document.querySelectorAll('.mix-strip'))row.querySelector('.mix-strip-fader').setAttribute('aria-disabled',String(!usable() || row.classList.contains('mix-strip-hidden')));if(!usable())cancel();}
  document.addEventListener('pointerdown',e=>{
    pointers.add(e.pointerId);if(pointers.size>1){cancel();return;}
    const slider=e.target.closest('.mix-strip-fader');if(!slider || slider.getAttribute('aria-disabled')==='true' || !usable() || e.button!==0)return;
    const row=slider.closest('.mix-strip'),source=row.dataset.source,s=x32Strips(x32Of(),bus).find(s=>s.source===source);if(!s)return;
    gesture=createVerticalFaderGesture({fullScalePx:slider.clientHeight});gesture.down(e.pointerId,e.clientX,e.clientY,(holds.get(key(source)) || s).value);drag={id:e.pointerId,source,row,level:s};
  });
  document.addEventListener('pointermove',e=>{
    if(!gesture || !drag || !usable())return;const value=gesture.move(e.pointerId,e.clientX,e.clientY);if(value===null)return;
    try{drag.row.setPointerCapture(e.pointerId);}catch(_){}drag.level={value,db:x32Db(value)};paint(drag.row,drag.level);send(drag.source,value);
  });
  document.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(!gesture || !drag || drag.id!==e.pointerId)return;const value=gesture.up(e.pointerId);if(value!==null && usable()){holds.commit(key(drag.source),drag.level);send(drag.source,value);}gesture=null;drag=null;updateLevels();});
  document.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);cancel();});
  $('.mix-list').addEventListener('scroll',()=>{if(drag)cancel();},{passive:true});
  window.addEventListener('blur',()=>{pointers.clear();cancel();});document.addEventListener('visibilitychange',()=>{pointers.clear();cancel();});
  return {render,cancel,updateLevels,syncAvailability};
}
