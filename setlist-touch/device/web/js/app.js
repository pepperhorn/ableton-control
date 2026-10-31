import {createTransportRenderer} from './transport-render.js';
import {createTapDetector} from './tap.js';
import {initialMixState, reduceMix} from './mix-view.js';
import {createMixRenderer} from './mix-render.js';
import {initialState, reduce, canLaunch, prefsOf, pageOf} from './view-state.js';
import {render, updatePlayback, fitSceneRows} from './render.js';
const $ = selector => document.querySelector(selector);
const local = ['localhost','127.0.0.1','[::1]','::1'].includes(location.hostname);
let prefs = {}; try { prefs = JSON.parse(localStorage.getItem('setlist-touch') || '{}') || {}; } catch (_) {}
let state = initialState(prefs), set = {songs:[],categories:[],sceneToSong:{}}, play = {playing:-1,fired:-1,playingSongId:null}, pos = null;
let snapshot = false, initialPlay = false, transport = false, mixSnapshot = false;
let mix = {returns:[],strips:[]}, mixState = initialMixState(prefs), mixJSON = null;
let setJSON = null, indexProgress = null, transportState = null, playSnapshot = false, monitorSongs = [];
let monitorUI = null, monitorLoading = false;
function paintMonitor() { if (monitorUI) monitorUI.render({songs:monitorSongs, play, pos, transport:transportState, connected:transport && playSnapshot}); }
function syncMonitor(active) {
  if (monitorUI) { monitorUI.setActive(active); paintMonitor(); return; }
  if (!active || monitorLoading) return;
  monitorLoading = true;
  import('./monitor-render.js').then(({createMonitorRenderer}) => {
    monitorUI = createMonitorRenderer(); shell();
  }).catch(() => { monitorLoading = false; status('Could not load Monitor. Reload to retry.'); });
}
const transportEnabled = new URLSearchParams(location.search).get('transport') === '1';
const detector = createTapDetector(), pointers = new Set();
const mixUI = createMixRenderer({
  stateOf:() => ({...state,connected:transport && mixSnapshot}), mixOf:() => mix, viewOf:() => mixState,
  onTab:name => dispatchMix({type:'tab',name}), onSnapshot:acceptMix, status
});
const transportUI = createTransportRenderer({
  enabled:transportEnabled,
  stateOf:() => ({...state, connected:transport && state.page !== 'monitor'}), status
});
function savePrefs() { try { localStorage.setItem('setlist-touch',JSON.stringify(prefsOf(state,{...mixState,page:state.page}))); } catch (_) {} }
function shell() {
  const settingsOpen = location.hash === '#settings' && local;
  document.body.dataset.page = state.page;
  $('.setlist-main').hidden = settingsOpen || state.page !== 'scenes';
  $('.mix-panel').hidden = settingsOpen || state.page !== 'mix';
  for (const button of document.querySelectorAll('.page-choice')) button.setAttribute('aria-pressed',String(button.dataset.page === state.page));
  $('.monitor-page').hidden = settingsOpen || state.page !== 'monitor';
  $('.transport-bar').hidden = !transportEnabled || state.page === 'monitor';
  syncMonitor(!settingsOpen && state.page === 'monitor');
  const ready = state.page === 'monitor' ? playSnapshot : state.page === 'mix' ? mixSnapshot && mix.returns.length > 0 : snapshot;
  const indexing = transport && indexProgress && indexProgress.done < indexProgress.total;
  $('.connection-bar').hidden = transport && ready && !indexing;
  $('.connection-label').hidden = !!indexing;
  $('.connection-label').textContent = transport ? 'Waiting for Live set…' : 'Reconnecting…';
  $('.index-progress').hidden = !indexing;
  if (indexing) {
    $('.index-progress-label').textContent = `Indexing Live set… ${indexProgress.done} / ${indexProgress.total}`;
    const percent = Math.round(indexProgress.done / indexProgress.total * 100);
    $('.index-progress-bar').style.width = percent + '%';
    $('.index-progress-track').setAttribute('aria-valuenow', String(percent));
    $('.index-progress-track').setAttribute('aria-valuetext', `${indexProgress.done} of ${indexProgress.total} scenes`);
  }
  mixUI.syncAvailability(); transportUI.syncAvailability();
}
function dispatchMix(action) {
  cancelGestures();
  // Page preference belongs to the shell; the existing mix reducer owns mix tabs.
  if (action.type === 'page') state = {...state, page:pageOf(action.page)};
  mixState = reduceMix(mixState,action,mix); savePrefs(); mixUI.render(); shell();
}
function acceptMix(next) {
  mixSnapshot = true;
  const serialized = JSON.stringify(next);
  if (serialized === mixJSON) { shell(); return; }
  mix = next; mixJSON = serialized; mixState = reduceMix(mixState,{type:'mix'},mix);
  savePrefs(); mixUI.render(); shell();
}
function cancelGestures() { for (const id of pointers) detector.move(id, Infinity, Infinity); mixUI.cancel(); transportUI.cancel(); }
function dispatch(action) {
  cancelGestures(); state = reduce(state, action, set);
  savePrefs();
  render(state, set, play, pos, local); shell();
}
render(state, set, play, pos, local); mixUI.render(); shell();
for (const button of document.querySelectorAll('.page-choice')) button.addEventListener('click',()=>dispatchMix({type:'page',page:button.dataset.page}));
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
  if (state.page !== 'scenes' || !canLaunch(state) || !row.isConnected) return;
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
  pointers.delete(e.pointerId); if(row){row.blur();launch(row);}
});
document.addEventListener('pointercancel',e=>{detector.cancel(e.pointerId);pointers.delete(e.pointerId);});
$('.scene-list').addEventListener('scroll',cancelGestures,{passive:true});
window.addEventListener('blur',cancelGestures);
document.addEventListener('visibilitychange',cancelGestures);
// Space belongs to Live's transport. Suppress browser defaults throughout this
// page (including focused navigation buttons); no keyboard gesture launches.
document.addEventListener('keydown',e=>{if(e.key===' ' && !(e.target instanceof Element && e.target.closest('input,textarea,select')))e.preventDefault();},{capture:true});
$('.scene-list').addEventListener('mousedown',e=>e.preventDefault());
new ResizeObserver(fitSceneRows).observe($('.scene-list'));
const events = new EventSource('/api/events');
events.addEventListener('open',()=>{transportState=null;playSnapshot=false;transportUI.reset();transport=true;snapshot=false;mixSnapshot=false;dispatch({type:'connected',value:false});});
events.addEventListener('error',()=>{transportState=null;playSnapshot=false;transportUI.reset();transport=false;snapshot=false;mixSnapshot=false;dispatch({type:'connected',value:false});});
events.addEventListener('transport',e=>{transportState=JSON.parse(e.data);transportUI.accept(transportState);paintMonitor();});
events.addEventListener('mix',e=>acceptMix(JSON.parse(e.data)));
events.addEventListener('level',e=>{
  const level=JSON.parse(e.data), strip=mix.strips.find(s=>s.trackIndex===level.trackIndex);
  if(!strip || !strip.levels[level.returnIndex])return;
  strip.levels[level.returnIndex]={value:level.value,label:level.label};mixJSON=JSON.stringify(mix);mixUI.updateLevels(level);
});
events.addEventListener('progress',e=>{indexProgress=JSON.parse(e.data);shell();});
events.addEventListener('set',e=>{
  const next=JSON.parse(e.data); monitorSongs=next.songs;
  // Keep the last song visible, but never enable launching from an empty set.
  if(!next.songs.length){snapshot=false;dispatch({type:'connected',value:false});return;}
  snapshot=true;
  const serialized=JSON.stringify(next);
  if(serialized===setJSON)return;
  set=next;setJSON=serialized;
  if(initialPlay)dispatch({type:'set',play});
});
events.addEventListener('play',e=>{
  playSnapshot=true;play=JSON.parse(e.data); if(pos&&pos.scene!==play.playing)pos=null;
  if(!initialPlay&&snapshot){initialPlay=true;dispatch({type:'set',play});}
  if(snapshot&&!state.connected)dispatch({type:'connected',value:true});
  updatePlayback(state,set,play,pos);shell();
});
events.addEventListener('pos',e=>{pos=JSON.parse(e.data);updatePlayback(state,set,play,pos);paintMonitor();});
async function settings() {
  const show=location.hash==='#settings'&&local;
  cancelGestures();$('.settings-panel').hidden=!show;$('.setlist-header').hidden=show;shell();
  if(!show)return;
  try {const res=await fetch('/api/config');if(!res.ok)throw new Error();const cfg=await res.json();for(const name of ['port','username'])$('.settings-form').elements[name].value=cfg[name];const password=$('.settings-form').elements.password;password.value='';password.placeholder=cfg.hasPassword?'Password set — leave blank to keep':'Set a password';}
  catch(_){$('.settings-status').textContent='Could not load settings.';}
}
window.addEventListener('hashchange',settings);settings();
$('.settings-form').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget;const cfg={port:Number(form.elements.port.value),username:form.elements.username.value,password:form.elements.password.value};
  const button=$('.settings-save');button.disabled=true;
  try {const res=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg)});if(!res.ok)throw new Error(await res.text());$('.settings-status').textContent='Saved.';if(cfg.port!==Number(location.port||80))location.href=`http://${location.hostname}:${cfg.port}/${location.search}#settings`;}
  catch(error){$('.settings-status').textContent=error.message||'Could not save settings.';}
  finally{button.disabled=false;}
});
