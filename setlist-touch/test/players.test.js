const {test}=require('node:test'), a=require('node:assert/strict'), fs=require('fs'),vm=require('vm');
function harness({wrapped=false,failCreate=false,failRoute=false,prefix='',count=3,failUndo=false}={}) {
 const type={identifier:'ext',display_name:'Ext. Out'}, main={identifier:'main',display_name:'Main'}, channel={identifier:'3/4',display_name:'3/4'};
 const returns=Array.from({length:count},(_,i)=>({name:i===0?'Verb':i===1?'Existing':'Player '+i,output_routing_type:i===0?main:type,output_routing_channel:channel,available_output_routing_types:[main,type],available_output_routing_channels:[channel]}));
 const writes=[],calls=[],out=[],dicts={};let operations=0;
 function LiveAPI(p){operations++;this.path=p;this.id=1;const r=()=>returns[Number(p.split(' ')[2])];
 this.getcount=k=>{operations++;return returns.length;};
 this.get=k=>{operations++;if(p==='live_set')return returns.flatMap((_,i)=>['id',100+i]);const v=r()[k];return k==='name'?[v]:[JSON.stringify(wrapped?{[k]:v}:v)];};
 this.set=(k,v)=>{operations++;writes.push([p,k,v]);if(k==='output_routing_type'&&failRoute)throw Error('route failed');r()[k]=k==='name'?prefix+v:JSON.parse(v);};
 this.call=method=>{operations++;calls.push(method);if(failUndo && /undo_step/.test(method))throw Error('undo unavailable');if(method==='create_return_track'){if(failCreate)throw Error('create failed');returns.push({name:'Return',output_routing_type:main,output_routing_channel:channel,available_output_routing_types:[main,type],available_output_routing_channels:[channel]});}};
 }
 const ctx=vm.createContext({LiveAPI,Dict:function(n){this.set=(k,v)=>dicts[n]=JSON.parse(v);},outlet:(...v)=>out.push(v),post:()=>{}});
 vm.runInContext(fs.readFileSync(require.resolve('../device/players.js'),'utf8'),ctx);
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

test('undo grouping failure is non-fatal and missing channel leaves a discoverable external return for retry',()=>{
 const h=harness({failUndo:true});h.ctx.add(1,'New','ext','');a.equal(h.result(1).ok,false);a.equal(h.returns.length,4);a.equal(h.returns[3].output_routing_type.identifier,'ext');
 h.ctx.outputs(2);a.equal(h.result(2).ok,true);a.ok(h.result(2).outputs.channels.length);h.ctx.add(3,'New','ext','3/4');a.equal(h.result(3).ok,true);a.equal(h.returns.length,4);
});
