import {test} from 'node:test';import a from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../device/web/js/access-view.js',import.meta.url),'utf8');
const {allowedPages,pageFor,allowedTabs,showPicker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const member={kind:'member',pages:['monitor'],mixes:['Alex']};
test('access off has all pages and no picker',()=>{a.deepEqual(allowedPages({kind:'open'}),['scenes','mix','monitor']);a.equal(showPicker({kind:'open'}),false);});
test('permission changes move revoked pages and filter renamed mix tabs immediately',()=>{
 a.equal(pageFor('scenes',member),'mix');a.deepEqual(allowedTabs({returns:[{name:'Alex'},{name:'Other'}]},member),[{name:'Alex'}]);
 const revoked={...member,mixes:[]};a.equal(pageFor('mix',revoked),'monitor');a.deepEqual(allowedTabs({returns:[{name:'Renamed'}]},member),[]);
 a.deepEqual(allowedPages({...revoked,pages:['transport']}),['monitor']);
 const removed={kind:'none',pages:['monitor'],mixes:[]};a.equal(showPicker(removed),true);a.equal(pageFor('scenes',removed),'monitor');
 a.equal(pageFor('scenes',{kind:'admin'}),'scenes');
});
