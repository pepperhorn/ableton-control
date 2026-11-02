import {test} from 'node:test';
import a from 'node:assert/strict';
import {createPlayerRenderer} from '../device/web/js/player-render.js';

test('form keeps unavailable Add disabled, names matched return before POST, and explains kept routing',async t=>{
  // Only the small DOM surface used by the renderer; no browser/runtime dependency.
  const node=()=>({value:'',textContent:'',disabled:false,options:[],append(option){this.options.push(option);},replaceChildren(){this.options=[];},before(other){this.previous=other;}});
  const warning=node(),message=node(),refreshButton=node();
  const fields=Object.fromEntries(['name','sendName','typeId','channelId','add'].map(k=>[k,node()]));
  const form={elements:fields,querySelector:s=>s==='.add-player-warning'?warning:s==='.add-player-status'?message:refreshButton};
  const oldDocument=globalThis.document,oldFetch=globalThis.fetch;
  t.after(()=>{globalThis.document=oldDocument;globalThis.fetch=oldFetch;});
  globalThis.document={querySelector:()=>form,createElement:()=>node()};
  let outputs={types:[],channels:[],returns:[]},reply={returnName:'A Gtr'},beforePost;
  const requests=[];
  globalThis.fetch=async(url,options)=>{
    if(url==='/api/player-outputs')return {ok:true,json:async()=>outputs};
    beforePost=warning.previous.textContent;requests.push(JSON.parse(options.body));return {ok:true,json:async()=>reply};
  };
  const renderer=createPlayerRenderer({refresh:async()=>{}});
  renderer.render(true);await new Promise(r=>setImmediate(r));
  a.equal(fields.typeId.options.length,1,'blank option still exists');a.equal(fields.add.disabled,true);
  await form.onsubmit({preventDefault(){}});a.equal(fields.add.disabled,true);a.equal(requests.length,0);
  outputs={types:[{identifier:'ext',display_name:'Ext. Out'}],channels:[{identifier:'3/4',display_name:'3/4'},{identifier:'5/6',display_name:'5/6'}],returns:[{index:1,name:'E Gtr',type:{identifier:'ext',display_name:'Ext. Out'},channel:{identifier:'3/4',display_name:'3/4'}}]};
  await refreshButton.onclick();
  const enter=name=>{fields.name.value=name;fields.name.oninput();};
  const choose=()=>{fields.channelId.value='5/6';form.onchange({target:fields.channelId});};
  enter('A Gtr');a.equal(warning.previous.textContent,'');choose();
  await form.onsubmit({preventDefault(){}});a.equal(requests.at(-1).reroute,false);a.equal(requests.at(-1).expectedRouting,null);
  enter('Gtr');a.match(warning.previous.textContent,/Existing return: E Gtr · Ext. Out · 3\/4/);choose();reply={returnName:'E Gtr'};
  await form.onsubmit({preventDefault(){}});a.match(beforePost,/Existing return: E Gtr/);a.equal(requests.at(-1).reroute,true);a.equal(requests.at(-1).expectedRouting.name,'E Gtr');
  enter('Late');choose();reply={returnName:'C-Late',routeKept:true};
  await form.onsubmit({preventDefault(){}});a.equal(requests.at(-1).reroute,false);a.match(message.textContent,/Linked existing return; its output was not changed/);
});
