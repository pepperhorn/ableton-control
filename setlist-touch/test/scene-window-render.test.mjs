import {test} from 'node:test';
import a from 'node:assert/strict';
import {renderSceneWindow} from '../device/web/js/scene-window-render.js';
test('scene renderer retains exact drawn raw names including End for launch',t=>{
 const oldDoc=globalThis.document,oldWindow=globalThis.window;
 t.after(()=>{globalThis.document=oldDoc;globalThis.window=oldWindow;});
 const node=()=>({dataset:{},style:{},children:[],classList:{toggle(){}},setAttribute(){},addEventListener(){},append(...c){this.children.push(...c);},replaceChildren(){this.children=[];},querySelector(s){return this.children.find(c=>'.'+c.className===s);}});
 globalThis.window={addEventListener(){}};globalThis.document={addEventListener(){},createElement:node};
 const el=node();el.querySelector=s=>el.children.find(n=>s.includes('"'+n.dataset.sceneIndex+'"'));
 renderSceneWindow(el,{rows:[{index:1,name:'* Actual scene',role:'current',color:0},{index:2,name:'',role:'after',color:0}]},{large:true,canLaunch:true,locked:false});
 a.equal(el.children[0].dataset.name,'* Actual scene');a.equal(el.children[1].dataset.name,'');a.equal(el.children[1].children[1].textContent,'■ End');
});
