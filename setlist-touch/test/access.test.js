const {test}=require('node:test'), a=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const {normalizeAccess,sign,verify,identify,can,meFor,newMember,checkAdminPassword}=require('../device/lib/access');
const {loadConfig}=require('../device/lib/config');
const member={id:'one',name:'Alex',pages:['monitor'],mixes:['Alex']};
const cfg=normalizeAccess({accessEnabled:true,members:[member],adminPassword:'secret'});
test('signed identities reject tampering, removed ids, changed secrets and malformed payloads',()=>{
 const token=sign({kind:'member',memberId:'one'},cfg.secret), resolve=(token,c=cfg)=>identify({cookie:'st_id='+token},c);
 a.equal(resolve(token).kind,'member');
 for(const bad of [token+'x','garbage',sign({kind:'member',memberId:'missing'},cfg.secret),sign(null,cfg.secret)])a.equal(resolve(bad).kind,'none');
 a.equal(resolve(token,{...cfg,secret:'a'.repeat(64)}).kind,'none');
 a.equal(verify(token,'other'),null); a.equal(resolve(token,{...cfg,members:[]}).kind,'none');
 a.equal(identify({trusted:true,cookie:'st_id=bad'},cfg).kind,'admin');
 a.equal(identify({},normalizeAccess({})).kind,'open');
});
test('capabilities and snapshots never leak passwords or secret',()=>{
 for(const kind of ['admin','open']) for(const action of ['fire','transport','send','admin'])a.equal(can({kind},action,'any'),true);
 for(const action of ['fire','transport','send','admin'])a.equal(can({kind:'none'},action,'Alex'),false);
 const who={kind:'member',member};a.equal(can(who,'send','Alex'),true);a.equal(can(who,'send','Renamed'),false);a.equal(can(who,'admin'),false);a.equal(can(who,'fire'),false);
 a.equal(can({kind:'member',member:{...member,pages:['scenes','transport']}},'fire'),true);
 a.equal(can({kind:'member',member:{...member,pages:['transport']}},'transport'),true);
 const me=JSON.stringify(meFor(who,cfg));a.ok(!me.includes(cfg.secret));a.ok(!me.includes('secret'));
 a.equal(checkAdminPassword('secret',cfg),true);a.equal(checkAdminPassword('Secret',cfg),false);a.equal(checkAdminPassword('',{adminPassword:''}),false);
 a.deepEqual(newMember('aLeX',['Alex','Alex 2']).mixes,['Alex']);a.deepEqual(newMember('Other',[]).pages,['monitor']);
});
test('legacy and damaged access fields preserve base credentials and persist generated secrets',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'access-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'config.json');
 const base={port:9020,username:'players',password:'band-pw'};
 for(const fields of [{},{members:null,accessEnabled:false},{members:[],accessEnabled:'false'},{members:[{}],accessEnabled:true}]){
  fs.writeFileSync(file,JSON.stringify({...base,...fields,adminPassword:42}));const loaded=loadConfig(file);
  for(const k of Object.keys(base))a.equal(loaded[k],base[k]);
  a.equal(loaded.accessEnabled,Object.keys(fields).length>0);a.deepEqual(loaded.members,[]);a.equal(loaded.adminPassword,'');
  a.match(loaded.secret,/^[a-f0-9]{64}$/);a.equal(loadConfig(file).secret,loaded.secret);
  a.equal(fs.statSync(file).mode & 0o777,0o600);
 }
});
