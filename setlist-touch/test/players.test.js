const {test}=require('node:test'), a=require('node:assert/strict'), fs=require('fs'),vm=require('vm');
function harness({wrapped=false,failCreate=false,failRoute=false,prefix='',count=3,failUndo=false,failConfirmation=false,zero=false}={}) {
 const type={identifier:zero?0:'ext',display_name:'Ext. Out'}, main={identifier:'main',display_name:'Main'}, channel={identifier:zero?0:'3/4',display_name:'3/4'};
 const returns=Array.from({length:count},(_,i)=>({name:i===0?'Verb':i===1?'Existing':'Player '+i,output_routing_type:i===0?main:type,output_routing_channel:channel,available_output_routing_types:[main,type],available_output_routing_channels:[channel]}));
 const writes=[],calls=[],out=[],dicts={};let operations=0;
 function LiveAPI(p){operations++;this.path=p;this.id=1;const r=()=>p==='live_set master_track'?{output_routing_type:type,output_routing_channel:channel}:returns[Number(p.split(' ')[2])];
 this.getcount=k=>{operations++;return returns.length;};
 this.get=k=>{operations++;if(p==='live_set' && failConfirmation && calls.includes('create_return_track'))return [];if(p==='live_set')return returns.flatMap((_,i)=>['id',100+i]);const v=r()[k];return k==='name'?[v]:[JSON.stringify(wrapped?{[k]:v}:v)];};
 this.set=(k,v)=>{operations++;writes.push([p,k,v]);if(k==='output_routing_type'&&failRoute)throw Error('route failed');r()[k]=k==='name'?prefix+v:JSON.parse(v);};
 this.call=method=>{operations++;calls.push(method);if(failUndo && /undo_step/.test(method))throw Error('undo unavailable');if(method==='create_return_track'){if(failCreate)throw Error('create failed');returns.push({name:'Return',output_routing_type:main,output_routing_channel:channel,available_output_routing_types:[main,type],available_output_routing_channels:[channel]});}};
 }
 const ctx=vm.createContext({LiveAPI,Dict:function(n){this.set=(k,v)=>dicts[n]=JSON.parse(v);},outlet:(...v)=>out.push(v),post:()=>{}});
 vm.runInContext(fs.readFileSync(require.resolve('../device/players.js'),'utf8'),ctx);
 const add=ctx.add;ctx.add=(id,name,typeId,channelId,options=JSON.stringify({explicitOutput:true}))=>add(id,name,typeId,channelId,options);
 return {ctx,returns,writes,calls,out,dicts,get operations(){return operations;},result:id=>dicts['setlist_touch_player_'+id]};
}
for(const wrapped of [false,true]) test('player output lists handle wrapped='+wrapped+' without writes and add/link use readback',()=>{
 const h=harness({wrapped,prefix:'D-'});h.ctx.outputs(1);a.equal(h.result(1).ok,true);a.equal(h.writes.length,0);a.equal(h.calls.length,0);a.ok(h.operations<=150);
 const before=h.operations;h.ctx.add(2,'New','ext','3/4');a.equal(h.result(2).ok,true);a.equal(h.result(2).returnName,'D-New');a.ok(h.operations-before<=150);a.ok(h.calls.includes('end_undo_step'));
 const writes=h.writes.length;h.ctx.add(3,'Existing','ext','3/4');a.equal(h.result(3).ok,true);a.equal(h.writes.length,writes);
 h.ctx.add(4,'Verb','ext','3/4');a.equal(h.result(4).ok,false);a.equal(h.writes.length,writes);a.match(h.result(4).message,/Main/);
 h.ctx.notifydeleted();const n=h.out.length;h.ctx.add(5,'No','ext','3/4');h.ctx.outputs(6);a.equal(h.out.length,n);
});
test('create failure attempts no name/routing; route failure leaves return and allows manual recovery',()=>{
 let h=harness({failCreate:true});h.ctx.add(1,'New','ext','3/4');a.equal(h.result(1).ok,false);a.equal(h.writes.length,0);
 h=harness({failRoute:true});h.ctx.add(1,'New','ext','3/4');a.equal(h.result(1).ok,false);a.equal(h.returns.length,4);a.match(h.result(1).message,/Return remains/);a.equal(h.writes.filter(w=>w[1]==='output_routing_channel').length,0);
 h.returns[3].output_routing_type={identifier:'ext',display_name:'Ext. Out'};h.ctx.add(2,'New','ext','3/4');a.equal(h.result(2).ok,true);a.equal(h.returns.length,4);
});
test('12-return limit refuses creation but existing external return still links within budget',()=>{
 const h=harness({count:12});h.ctx.add(1,'New','ext','3/4');a.equal(h.result(1).ok,false);a.equal(h.writes.length,0);const before=h.operations;h.ctx.add(2,'Existing','ext','3/4');a.equal(h.result(2).ok,true);a.ok(h.operations-before<=150);
});
test('unknown route and output identifiers fail closed without further writes',()=>{
 const h=harness();h.returns[1].output_routing_type={display_name:'Unknown'};h.ctx.add(1,'Existing','ext','3/4');a.equal(h.writes.length,0);
 h.ctx.add(2,'New','missing','3/4');a.equal(h.result(2).ok,false);a.equal(h.writes.filter(w=>w[1].startsWith('output')).length,0);
});

test('undo failure is non-fatal; missing explicit channel refuses creation entirely',()=>{
 const h=harness({failUndo:true});h.ctx.add(1,'New','ext','');a.equal(h.result(1).ok,false);a.equal(h.returns.length,3);a.equal(h.writes.length,0);
 h.ctx.add(2,'New','ext','3/4');a.equal(h.result(2).ok,true);a.equal(h.returns.length,4);
});

function options(reroute, ret, index=1) {return JSON.stringify({explicitOutput:true,reroute,expectedRouting:ret && {index,name:ret.name,typeId:ret.output_routing_type.identifier,channelId:ret.output_routing_channel.identifier}});}
test('prefixed retries do not create duplicates, normalised Main refusal and ambiguity are fail-closed',()=>{
 const h=harness({prefix:'D-',failRoute:true});
 h.ctx.add(1,' New ','ext','3/4');a.equal(h.returns.length,4);a.equal(h.returns[3].name,'D-New');
 h.ctx.add(2,'New','ext','3/4');h.ctx.add(3,'New','ext','3/4');a.equal(h.returns.length,4);a.match(h.result(3).message,/Main/);a.doesNotMatch(h.result(3).message,/Error:|\.\./);
 h.returns[3].output_routing_type={identifier:'ext',display_name:'Ext. Out'};h.ctx.add(4,'New','ext','3/4');a.equal(h.result(4).returnName,'D-New');a.equal(h.returns.length,4);
 h.returns[0].name='A-Verb';h.ctx.add(5,' Verb ','ext','3/4');a.match(h.result(5).message,/Main/);
 h.returns[1].name='C-New';h.ctx.add(6,'New','ext','3/4');a.match(h.result(6).message,/More than one/);
});
test('successful prefixed Add links on repetition and exact match wins over alias',()=>{
 const h=harness({prefix:'D-'});h.ctx.add(1,'Keith','ext','3/4');h.ctx.add(2,'Keith','ext','3/4');a.equal(h.returns.length,4);a.equal(h.result(2).returnName,'D-Keith');
 h.returns[1].name='Keith';h.ctx.add(3,'Keith','ext','3/4');a.equal(h.result(3).returnName,'Keith');
});
test('keep route is default, explicit reroute needs matching observed route and stale route stops writes',()=>{
 const h=harness();const ret=h.returns[1];ret.output_routing_channel={identifier:'5/6',display_name:'5/6'};
 h.ctx.add(1,' Existing ','ext','3/4');a.equal(h.result(1).ok,true);a.equal(h.writes.length,0);a.equal(ret.output_routing_channel.identifier,'5/6');
 const seen=options(true,ret);h.ctx.add(2,'Existing','ext','3/4',seen);a.equal(h.result(2).ok,true);a.equal(h.writes.length,1);a.equal(ret.output_routing_channel.identifier,'3/4');
 h.ctx.add(3,'Existing','ext','3/4',seen);a.equal(h.result(3).ok,false);a.match(h.result(3).message,/routing changed/);a.equal(h.writes.length,1);
});
test('zero-valued opaque routing identifiers work for creation and explicit reroute',()=>{
 const h=harness();const type={identifier:0,display_name:'Ext. Out'},channel={identifier:0,display_name:'1/2'};
 const ret=h.returns[1];ret.available_output_routing_types=[type];ret.available_output_routing_channels=[channel];
 h.ctx.add(1,'Existing','0','0',options(true,ret));a.equal(h.result(1).ok,true);a.equal(ret.output_routing_type.identifier,0);a.equal(ret.output_routing_channel.identifier,0);
});
test('outputs include readable Main output without mutation or default assignment',()=>{
 const h=harness();h.ctx.outputs(1);a.equal(h.result(1).outputs.main.name,'Main');a.equal(h.result(1).outputs.main.channel.identifier,'3/4');a.equal(h.writes.length,0);
});

test('created-but-unconfirmed return reports retention and stops before naming/routing',()=>{
 const h=harness({failConfirmation:true});h.ctx.add(1,'New','ext','3/4');a.equal(h.result(1).ok,false);a.match(h.result(1).message,/Return remains/);a.equal(h.returns.length,4);a.equal(h.writes.length,0);
});
test('new return can choose identifier zero',()=>{
 const h=harness({zero:true});h.ctx.add(1,'New','0','0');a.equal(h.result(1).ok,true);a.equal(h.returns[3].output_routing_type.identifier,0);
});
