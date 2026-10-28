import {test} from 'node:test';
import a from 'node:assert/strict';
import {initialMixState, reduceMix, faderValue, valueLabel} from '../device/web/js/mix-view.js';
import {prefsOf, initialState, canLaunch} from '../device/web/js/view-state.js';
const mix = {returns:[{returnIndex:2,name:'Shaun'},{returnIndex:3,name:'Keith'}]};
test('page and tab restore; reconciliation uses return names and falls back',()=>{
 let state=initialMixState({page:'mix',tab:'Keith'});state=reduceMix(state,{type:'mix'},mix);a.equal(state.tab,'Keith');
 state=reduceMix(state,{type:'mix'},{returns:[{returnIndex:7,name:'Keith'}]});a.equal(state.tab,'Keith');
 state=reduceMix(state,{type:'mix'},{returns:[{name:'Sam'}]});a.equal(state.tab,'Sam');
 state=reduceMix(state,{type:'mix'},{returns:[]});a.equal(state.tab,null);
 a.equal(reduceMix(state,{type:'page',page:'scenes'},mix).page,'scenes');a.equal(initialMixState({page:'bogus'}).page,'scenes');
 a.deepEqual(prefsOf(initialState(),{page:'mix',tab:'Keith'}),{sidebarOpen:true,locked:false,filter:null,page:'mix',tab:'Keith'});
});
test('remote levels stay beneath a drag and appear when no release hold remains',()=>{
 const remote={value:0.2,label:'-20 dB'},drag={value:0.8,label:'-2 dB'};
 a.equal(faderValue(remote,drag),drag);a.equal(faderValue(remote,null),remote);
 a.equal(valueLabel(remote),'-20 dB');a.match(valueLabel({value:0.5,label:''}),/≈/);
});
test('shared lock and connection guard blocks fader input',()=>{
 a.equal(canLaunch({connected:true,locked:true}),false);a.equal(canLaunch({connected:false,locked:false}),false);a.equal(canLaunch({connected:true,locked:false}),true);
});

test('released fader holds its value until its own echo, without delaying other faders',async()=>{
 const {createFaderHolds}=await import('../device/web/js/mix-view.js');
 const timers=[],expired=[];
 const holds=createFaderHolds({setTimer:(fn,ms)=>{const timer={fn,ms};timers.push(timer);return timer;},clearTimer:t=>t.cancelled=true,onExpire:()=>expired.push(true)});
 const released={value:0.8,label:''},old={value:0.2,label:'old'};
 holds.commit('0:2',released);a.equal(timers[0].ms,1000);
 a.equal(faderValue(old,null,holds.get('0:2')),released);
 holds.echo('1:2');a.equal(holds.get('0:2'),released);
 holds.echo('0:2');a.equal(holds.get('0:2'),null);a.equal(timers[0].cancelled,true);
 a.equal(faderValue(old,null,holds.get('0:2')),old);a.deepEqual(expired,[]);
});
test('release hold expires to latest server value; replacement timers and cancellation cannot revive it',async()=>{
 const {createFaderHolds}=await import('../device/web/js/mix-view.js');
 const timers=[],expired=[];
 const holds=createFaderHolds({setTimer:(fn,ms)=>{const timer={fn,ms};timers.push(timer);return timer;},clearTimer:t=>t.cancelled=true,onExpire:()=>expired.push(true)});
 holds.commit('0:2',{value:0.8,label:''});holds.commit('0:2',{value:0.9,label:''});
 timers[0].fn();a.equal(holds.get('0:2').value,0.9,'an obsolete queued timer cannot clear a newer release');
 timers[1].fn();a.equal(holds.get('0:2'),null);a.equal(expired.length,1);
 const latest={value:0.4,label:'Live'};a.equal(faderValue(latest,null,holds.get('0:2')),latest);
 holds.commit('0:2',{value:0.8,label:''});holds.clear();timers[2].fn();a.equal(holds.get('0:2'),null);a.equal(expired.length,1);
});
