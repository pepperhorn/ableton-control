import {createTapDetector} from './tap.js';
const bindings = new WeakMap();
function bind(el) {
  const tap = createTapDetector(), nodes = new Map();
  const binding = {options:{},view:null};
  const cancel = () => { for (const id of nodes.keys()) tap.move(id,Infinity,Infinity); };
  const rowAt = target => { const row = target && target.closest('.scene-window-row'); return row && el.contains(row) ? row : null; };
  document.addEventListener('pointerdown',e => {
    nodes.set(e.pointerId,true);
    const {canLaunch,locked} = binding.options;
    tap.down(e.pointerId,e.clientX,e.clientY,e.timeStamp,e.button===0 && canLaunch && !locked ? rowAt(e.target) : null);
  });
  document.addEventListener('pointermove',e=>tap.move(e.pointerId,e.clientX,e.clientY));
  document.addEventListener('pointerup',e=>{
    const row=tap.up(e.pointerId,e.clientX,e.clientY,e.timeStamp,rowAt(document.elementFromPoint(e.clientX,e.clientY)));
    nodes.delete(e.pointerId);
    const {canLaunch,locked,onLaunch} = binding.options;
    if(row && row.isConnected && canLaunch && !locked) { row.blur(); onLaunch(Number(row.dataset.sceneIndex)); }
  });
  document.addEventListener('pointercancel',e=>{tap.cancel(e.pointerId);nodes.delete(e.pointerId);});
  el.addEventListener('scroll',cancel,{passive:true});
  window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',cancel);
  binding.cancel = cancel; bindings.set(el,binding); return binding;
}
export function renderSceneWindow(el, view, options) {
  const binding = bindings.get(el) || bind(el);
  const key=JSON.stringify([view && view.rows.map(r=>({...r,progress:null})),options.large,options.canLaunch,options.locked]);
  binding.options=options;binding.view=view;
  if(key!==binding.key) {
    binding.cancel(); binding.key=key;el.replaceChildren();
    el.classList.toggle('scene-window-large',!!options.large);
    for(const row of view ? view.rows : []) {
      const node=document.createElement(options.canLaunch?'button':'div');
      node.className='scene-window-row scene-window-'+row.role;
      node.dataset.sceneIndex=row.index;
      if(options.canLaunch) {node.type='button';node.setAttribute('aria-disabled',String(options.locked));}
      const color=row.color>>>0;
      node.style.backgroundColor='#'+color.toString(16).padStart(6,'0').slice(-6);
      const linear=[16,8,0].map(s=>((color>>s)&255)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
      node.style.color=linear.reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0)>.179?'#000':'#fff';
      const fill=document.createElement('span');fill.className='scene-window-fill';fill.setAttribute('aria-hidden','true');
      const name=document.createElement('span');name.className='scene-window-name';name.textContent=row.name || '■ End';
      const counter=document.createElement('span');counter.className='scene-window-counter';
      node.append(fill,name,counter);el.append(node);
    }
  }
  for(const row of view ? view.rows : []) {
    const node=el.querySelector(`[data-scene-index="${row.index}"]`);
    const fill=node.querySelector('.scene-window-fill');fill.hidden=!row.progress;
    if(row.progress)fill.style.width=row.progress.fraction*100+'%';
    node.querySelector('.scene-window-counter').textContent=row.progress?`${row.progress.bar} / ${Math.ceil(row.progress.bars)}`:row.bars?`${Math.ceil(row.bars)} bars`:'';
  }
}
