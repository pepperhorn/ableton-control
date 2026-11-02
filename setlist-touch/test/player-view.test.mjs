import {test} from 'node:test';import a from 'node:assert/strict';
import {sendNameFor,outputLabel,playerWarning} from '../device/web/js/player-view.js';
import {reduceMix,initialMixState} from '../device/web/js/mix-view.js';
test('send follows player until edited, output occupancy and limits are visible',()=>{
 a.equal(sendNameFor('Shaun','Old',false),'Shaun');a.equal(sendNameFor('Shaun','Horns',true),'Horns');
 a.match(outputLabel({identifier:'3/4',display_name:'3/4'},[{name:'Horns',channel:{identifier:'3/4'}}]),/Horns/);
 a.match(playerWarning({types:[],channels:[],returns:[]}),/audio preferences/);
 a.match(playerWarning({types:[{}],channels:[],returns:[]}),/Configure an external return/);
 a.match(playerWarning({types:[{}],channels:[{}],returns:Array(12).fill({})}),/12 returns/);
});
test('empty startup mix on server restart preserves saved selected mix until actual returns arrive',()=>{
 let state=initialMixState({page:'mix',tab:'Keith'});state=reduceMix(state,{type:'mix'},{returns:[]});a.equal(state.tab,'Keith');
 state=reduceMix(state,{type:'mix'},{returns:[{name:'Shaun'},{name:'Keith'}]});a.equal(state.tab,'Keith');
});

test('normalised return lookup trims, prefers exact, rejects ambiguous aliases and labels Main',async()=>{
 const {matchReturn,routingSeen}=await import('../device/web/js/player-view.js');
 const ret={index:2,name:'C-Keith',type:{identifier:0},channel:{identifier:0}};
 a.equal(matchReturn([ret],' Keith '),ret);a.equal(routingSeen(ret).channelId,0);
 a.throws(()=>matchReturn([ret,{name:'D-Keith'}],'Keith'),/More than one/);
 a.equal(matchReturn([ret,{name:'Keith'}],'Keith').name,'Keith');
 a.match(outputLabel({identifier:'1/2',display_name:'1/2'},[],{name:'Main',channel:{identifier:'1/2'}}),/Main/);
});

test('readable Main output absent from return choices stays labelled informational and disabled',async()=>{
 const {outputChannels}=await import('../device/web/js/player-view.js');
 const channels=outputChannels({channels:[{identifier:'3/4',display_name:'3/4'}],returns:[],main:{channel:{identifier:'1/2',display_name:'1/2'}}});
 a.match(channels[1].label,/Main: 1\/2/);a.equal(channels[1].disabled,true);a.equal(channels[1].identifier,'');
});
