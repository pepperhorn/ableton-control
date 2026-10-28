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
test('remote level remains underneath a drag and is visible immediately on release',()=>{
 const remote={value:0.2,label:'-20 dB'},drag={value:0.8,label:'-2 dB'};
 a.equal(faderValue(remote,drag),drag);a.equal(faderValue(remote,null),remote);
 a.equal(valueLabel(remote),'-20 dB');a.match(valueLabel({value:0.5,label:''}),/≈/);
});
test('shared lock and connection guard blocks fader input',()=>{
 a.equal(canLaunch({connected:true,locked:true}),false);a.equal(canLaunch({connected:false,locked:false}),false);a.equal(canLaunch({connected:true,locked:false}),true);
});
