import {createTapDetector} from './tap.js';
import {initialState, reduce, canLaunch, prefsOf} from './view-state.js';
import {render, updatePlayback, fitSceneRows} from './render.js';
const $ = selector => document.querySelector(selector);
const local = ['localhost','127.0.0.1','[::1]','::1'].includes(location.hostname);
let prefs = {}; try { prefs = JSON.parse(localStorage.getItem('setlist-touch') || '{}') || {}; } catch (_) {}
let state = initialState(prefs), set = {songs:[],categories:[],sceneToSong:{}}, play = {playing:-1,fired:-1,playingSongId:null}, pos = null;
let snapshot = false, initialPlay = false;
const detector = createTapDetector(), pointers = new Set();
function cancelGestures() { for (const id of pointers) detector.move(id, Infinity, Infinity); }
function dispatch(action) {
  cancelGestures(); state = reduce(state, action, set);
  try { localStorage.setItem('setlist-touch',JSON.stringify(prefsOf(state))); } catch (_) {}
  render(state, set, play, pos, local);
}
render(state, set, play, pos, local);
$('.sidebar-toggle').addEventListener('click',()=>dispatch({type:'toggleSidebar'}));
$('.lock-toggle').addEventListener('click',()=>dispatch({type:'toggleLock'}));
$('.song-nav-prev').addEventListener('click',()=>dispatch({type:'stepSong',dir:-1}));
$('.song-nav-next').addEventListener('click',()=>dispatch({type:'stepSong',dir:1}));
$('.filter-pills').addEventListener('chooseFilter',e=>dispatch({type:'filter',category:e.detail}));
$('.setlist-songs').addEventListener('click',e=>{const button=e.target.closest('.setlist-item');if(button)dispatch({type:'selectSong',id:Number(button.dataset.songId)});});
$('.now-playing-banner').addEventListener('click',()=>dispatch({type:'showPlaying',play}));
let statusTimer;
function status(text) { clearTimeout(statusTimer); $('.launch-status').textContent = text; statusTimer = setTimeout(()=>$('.launch-status').textContent='',3500); }
async function launch(row) {
  if (!canLaunch(state) || !row.isConnected) return;
  try {
    const res = await fetch('/api/fire',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sceneIndex:Number(row.dataset.sceneIndex),name:row.dataset.name})});
    if (res.status === 409) { row.classList.add('is-stale'); setTimeout(()=>row.classList.remove('is-stale'),1000); status('Set changed. Check the row and tap again.'); }
    else if (!res.ok) status('Could not launch. Check the connection.');
  } catch (_) { status('Could not launch. Reconnecting…'); dispatch({type:'connected',value:false}); }
}
// Listen on the whole document so a second finger outside the row also blocks launch.
document.addEventListener('pointerdown',e=>{
  pointers.add(e.pointerId);
  const row=e.target.closest('.scene-row');
  detector.down(e.pointerId,e.clientX,e.clientY,e.timeStamp,e.button === 0 && canLaunch(state) ? row : null);
});
document.addEventListener('pointermove',e=>detector.move(e.pointerId,e.clientX,e.clientY));
document.addEventListener('pointerup',e=>{
  // Touch browsers implicitly capture pointers; hit-test the real release position.
  const hit=document.elementFromPoint(e.clientX,e.clientY);
  const row=detector.up(e.pointerId,e.clientX,e.clientY,e.timeStamp,hit && hit.closest('.scene-row'));
  pointers.delete(e.pointerId); if(row)launch(row);
});
document.addEventListener('pointercancel',e=>{detector.cancel(e.pointerId);pointers.delete(e.pointerId);});
$('.scene-list').addEventListener('scroll',cancelGestures,{passive:true});
window.addEventListener('blur',cancelGestures);
document.addEventListener('visibilitychange',cancelGestures);
$('.scene-list').addEventListener('keydown',e=>{const row=e.target.closest('.scene-row');if(row&&!e.repeat&&(e.key==='Enter'||e.key===' ')){e.preventDefault();launch(row);}});
new ResizeObserver(fitSceneRows).observe($('.scene-list'));
const events = new EventSource('/api/events');
events.addEventListener('open',()=>{snapshot=false;dispatch({type:'connected',value:false});});
events.addEventListener('error',()=>{snapshot=false;dispatch({type:'connected',value:false});});
events.addEventListener('set',e=>{
  set=JSON.parse(e.data); snapshot=true;
  if(initialPlay)dispatch({type:'set',play});
});
events.addEventListener('play',e=>{
  play=JSON.parse(e.data); if(pos&&pos.scene!==play.playing)pos=null;
  if(!initialPlay&&snapshot){initialPlay=true;dispatch({type:'set',play});}
  if(snapshot&&!state.connected)dispatch({type:'connected',value:true});
  updatePlayback(state,set,play,pos);
});
events.addEventListener('pos',e=>{pos=JSON.parse(e.data);updatePlayback(state,set,play,pos);});
async function settings() {
  const show=location.hash==='#settings'&&local;
  cancelGestures();$('.settings-panel').hidden=!show;$('.setlist-main').hidden=show;$('.setlist-header').hidden=show;
  if(!show)return;
  try {const res=await fetch('/api/config');if(!res.ok)throw new Error();const cfg=await res.json();for(const name of ['port','username','password'])$('.settings-form').elements[name].value=cfg[name];}
  catch(_){$('.settings-status').textContent='Could not load settings.';}
}
window.addEventListener('hashchange',settings);settings();
$('.settings-form').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget;const cfg={port:Number(form.elements.port.value),username:form.elements.username.value,password:form.elements.password.value};
  const button=$('.settings-save');button.disabled=true;
  try {const res=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg)});if(!res.ok)throw new Error(await res.text());$('.settings-status').textContent='Saved.';if(cfg.port!==Number(location.port||80))location.href=`http://${location.hostname}:${cfg.port}/#settings`;}
  catch(error){$('.settings-status').textContent=error.message||'Could not save settings.';}
  finally{button.disabled=false;}
});
