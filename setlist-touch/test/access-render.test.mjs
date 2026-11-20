import {test} from 'node:test';
import a from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {showPicker} from '../device/web/js/access-view.js';
const source=fs.readFileSync(new URL('../device/web/js/access-render.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function','function');
function harness({kind='admin',hostname='192.168.1.10',store=new Map(),broken=false}={}) {
 const nodes=new Map();const node=()=>({hidden:false,textContent:'',children:[],replaceChildren(){this.children=[];},append(...children){this.children.push(...children);}});
 const get=s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);};
 const me={kind,accessEnabled:true,name:null,members:[{id:'alex',name:'Alex'}]};
 const ctx={showPicker,document:{querySelector:get,createElement:node},location:{hostname,hash:'',reload(){}},localStorage:{getItem:k=>{if(broken)throw Error();return store.get(k);},setItem:(k,v)=>{if(broken)throw Error();store.set(k,v);}},createPlayerRenderer:()=>({render(){}})};
 // Keep the context to re-render the real renderer and invoke real button handlers.
 const context=vm.createContext({...ctx,me});vm.runInContext(source+'\nglobalThis.ui=createAccessRenderer({meOf:()=>me,mixOf:()=>({returns:[]}),refresh:async()=>{},status(){}});',context);
 context.ui.render();return {get,me,ui:context.ui,store};
}
for(const kind of ['admin','open'])test(`${kind} dismiss persists across renderer reload and header can reopen`,()=>{
 const store=new Map(),h=harness({kind,store});a.equal(h.get('.name-picker').hidden,false);a.equal(h.get('.name-dismiss').hidden,false);
 h.get('.name-dismiss').onclick();a.equal(h.get('.name-picker').hidden,true);
 const reload=harness({kind,store});a.equal(reload.get('.name-picker').hidden,true);
 reload.get('.change-name').onclick();a.equal(reload.get('.name-picker').hidden,false);
 reload.get('.name-dismiss').onclick();a.equal(reload.get('.name-picker').hidden,true);
});
test('none cannot dismiss despite stored optional preference',()=>{
 const h=harness({kind:'none',store:new Map([['st.pickerDismissed','1']])});a.equal(h.get('.name-picker').hidden,false);a.equal(h.get('.name-dismiss').hidden,true);h.get('.name-dismiss').onclick();a.equal(h.get('.name-picker').hidden,false);
});
for(const hostname of ['127.0.0.1','127.0.0.2','localhost','[::1]'])test(`loopback/jweb ${hostname} only prompts from header`,()=>{
 const h=harness({hostname});a.equal(h.get('.name-picker').hidden,true);a.equal(h.get('.change-name').hidden,false);
 h.get('.change-name').onclick();a.equal(h.get('.name-picker').hidden,false);a.equal(h.get('.name-dismiss').hidden,false);
});
test('storage failures still allow optional prompt dismissal',()=>{
 const h=harness({broken:true});a.doesNotThrow(()=>h.get('.name-dismiss').onclick());a.equal(h.get('.name-picker').hidden,true);
});
