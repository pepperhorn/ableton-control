import {test} from 'node:test';import a from 'node:assert/strict';
import {sendNameFor,outputLabel,playerWarning} from '../device/web/js/player-view.js';
import {reduceMix,initialMixState} from '../device/web/js/mix-view.js';
test('send follows player until edited, output occupancy and limits are visible',()=>{
 a.equal(sendNameFor('Shaun','Old',false),'Shaun');a.equal(sendNameFor('Shaun','Horns',true),'Horns');
 a.match(outputLabel({identifier:'3/4',display_name:'3/4'},[{name:'Horns',channel:{identifier:'3/4'}}]),/Horns/);
 a.match(playerWarning({types:[],channels:[],returns:[]}),/audio preferences/);
 a.match(playerWarning({types:[{}],channels:[],returns:[]}),/creates the return first/);
 a.match(playerWarning({types:[{}],channels:[{}],returns:Array(12).fill({})}),/12 returns/);
});
test('empty startup mix on server restart preserves saved selected mix until actual returns arrive',()=>{
 let state=initialMixState({page:'mix',tab:'Keith'});state=reduceMix(state,{type:'mix'},{returns:[]});a.equal(state.tab,'Keith');
 state=reduceMix(state,{type:'mix'},{returns:[{name:'Shaun'},{name:'Keith'}]});a.equal(state.tab,'Keith');
});
