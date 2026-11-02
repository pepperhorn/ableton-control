import {test} from 'node:test';import a from 'node:assert/strict';
import {sendNameFor,outputLabel,playerWarning} from '../device/web/js/player-view.js';
import {reduceMix,initialMixState} from '../device/web/js/mix-view.js';
test('send follows player until edited, output occupancy and limits are visible',()=>{
 a.equal(sendNameFor('Shaun','Old',false),'Shaun');a.equal(sendNameFor('Shaun','Horns',true),'Horns');
 a.match(outputLabel({identifier:'3/4',display_name:'3/4'},[{name:'Horns',channel:{identifier:'3/4'}}]),/Horns/);
 a.match(playerWarning({types:[],channels:[],returns:[]}),/audio preferences/);
 a.match(playerWarning({types:[{}],channels:[],returns:[]}),/Route one return to Ext. Out in Live/);
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

for(const matcher of ['server','browser'])test(matcher+' matcher strips only Live names; A Gtr never matches E Gtr',async()=>{
 const {matchReturn}=await import(matcher==='server'?'../device/lib/access.js':'../device/web/js/player-view.js');
 const e={name:'E Gtr'},aa={name:'A Gtr'},prefixed={name:'D-A Gtr'};
 a.equal(matchReturn([e],'A Gtr'),null);a.equal(matchReturn([aa,e],'B Gtr'),null);
 a.equal(matchReturn([e,prefixed],' A Gtr '),prefixed);a.equal(matchReturn([e,aa,prefixed],'A Gtr'),aa);
 a.equal(matchReturn([e],'Gtr'),e);a.equal(matchReturn([{name:'D-Keith'}],'Keith').name,'D-Keith');
 a.equal(matchReturn([{name:'A-Verb'}],'Verb').name,'A-Verb');
 a.throws(()=>matchReturn([{name:'D-Keith'},{name:'E-Keith'}],'Keith'),/More than one/);
});
test('Main label uses readable channel name when opaque identifiers differ',async()=>{
 const {outputChannels}=await import('../device/web/js/player-view.js');
 const outputs={channels:[{identifier:'return-pair',display_name:'1/2'}],returns:[],main:{name:'Main',channel:{identifier:'master-pair',display_name:'1/2'}}};
 a.match(outputLabel(outputs.channels[0],[],outputs.main),/Main/);const choices=outputChannels(outputs);a.equal(choices.length,1);a.match(choices[0].label,/Main/);a.equal(choices[0].identifier,'return-pair');
});
