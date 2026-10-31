import {test} from 'node:test';
import a from 'node:assert/strict';
import {createRequire} from 'node:module';
import {monitorView} from '../device/web/js/monitor-view.js';
const {progress} = createRequire(import.meta.url)('../device/lib/progress');
const current = {name:'Verse',color:255,loopBeats:32,beatsPerBar:4};
const base = {songs:[{id:1,title:'Song'}],play:{playing:2,fired:-1,playingSongId:1,current,next:null},
  transport:{is_playing:1},connected:true};
test('current uses existing progress calculation, matching the scene only', () => {
  const pos = {scene:2,...progress({position:9,loopStart:0,loopEnd:32,beatsPerBar:4})};
  const view = monitorView({...base,pos});
  a.equal(view.current.name,'Verse');a.equal(view.song,'Song');a.equal(view.progress,pos);a.equal(view.progress.bar,3);
  a.equal(monitorView({...base,pos:{...pos,scene:3}}).progress,null);
});
test('scene without timing clip shows its exact title only', () => {
  const view = monitorView({...base,play:{...base.play,current:{...current,loopBeats:null}},pos:{scene:2,bar:3,bars:8,fraction:.3}});
  a.equal(view.current.name,'Verse');a.equal(view.progress,null);
});
test('next appears only while queued, including a relaunch of current', () => {
  a.equal(monitorView({...base,play:{...base.play,next:current}}).next,null);
  const queued = monitorView({...base,play:{...base.play,fired:2,next:current}});
  a.deepEqual(queued.next,queued.current);
  a.equal(monitorView({...base,play:{...base.play,fired:3,next:{...current,name:'Chorus'}}}).next.name,'Chorus');
});
test('song title uses only playingSongId and is empty before first title', () => {
  for (const playingSongId of [null,undefined,99]) a.equal(monitorView({...base,play:{...base.play,playingSongId}}).song,'');
  a.equal(monitorView(base).song,'Song');
});
test('only literal leading star-space is stripped from Live scene titles', () => {
  for (const [name,expected] of [['* Song','Song'],['*  Song',' Song'],['** Song','** Song'],['Verse * X','Verse * X'],['','']]) {
    a.equal(monitorView({...base,play:{...base.play,current:{...current,name}}}).current.name,expected);
  }
});
test('stopped transport overrides a stale playing index; untracked running scene is neutral Playing', () => {
  const stopped = monitorView({...base,transport:{is_playing:0}});
  a.equal(stopped.status,'Stopped');a.equal(stopped.current,null);a.equal(stopped.song,'');a.equal(stopped.progress,null);
  const playing = monitorView({...base,play:{playing:-1,fired:-1,current:null}});
  a.equal(playing.status,'Playing');a.equal(playing.current,null);
  a.equal(monitorView({...base,play:{playing:-1},transport:{is_playing:0}}).status,'Stopped');
});
test('disconnect clears current, queue, song and progress immediately', () => {
  a.deepEqual(monitorView({...base,connected:false,play:{...base.play,fired:2,next:current}}),
    {status:'Disconnected',song:'',current:null,next:null,progress:null});
});
