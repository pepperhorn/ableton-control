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
  a.match(loaded.secret,/^[a-f0-9]{64}$/);
  if(!Object.keys(fields).length){a.equal(loadConfig(file).secret,loaded.secret);a.equal(fs.statSync(file).mode & 0o777,0o600);}else a.deepEqual(JSON.parse(fs.readFileSync(file)).members,fields.members);
 }
});

test('damaged config bytes survive load and fallback access stays restricted',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'damaged-access-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'config.json');
 for(const bytes of ['{"password":"keep",',JSON.stringify({port:99999,username:'band',password:'keep',accessEnabled:true,members:[]}),JSON.stringify({port:8765,username:'band',password:'keep',accessEnabled:true,members:'damaged'})]){
  fs.writeFileSync(file,bytes);const cfg=loadConfig(file);
  a.equal(fs.readFileSync(file,'utf8'),bytes);a.equal(cfg.accessEnabled,true);a.deepEqual(cfg.members,[]);
  a.equal(identify({trusted:true,cookie:'st_id=broken'},cfg).kind,'admin');
 }
});
test('legacy migration adds only the secret, preserving all original fields',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'legacy-access-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'config.json');
 const original={username:'band',password:'keep',custom:{keep:true}};
 fs.writeFileSync(file,JSON.stringify(original));const cfg=loadConfig(file);a.deepEqual(JSON.parse(fs.readFileSync(file)),{...original,secret:cfg.secret});
});
test('EACCES while persisting a legacy secret cannot stop the laptop server',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'readonly-access-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'config.json');
 const original={port:8765,username:'band',password:'keep'};
 fs.writeFileSync(file,JSON.stringify(original));const write=fs.writeFileSync;
 fs.writeFileSync=(target,...args)=>{if(target===file+'.tmp')throw Object.assign(new Error('read-only'),{code:'EACCES'});return write(target,...args);};
 let loaded;try { a.doesNotThrow(()=>{loaded=loadConfig(file);}); } finally {fs.writeFileSync=write;}
 a.match(loaded.secret,/^[a-f0-9]{64}$/);a.equal(loaded.password,'keep');a.equal(identify({trusted:true},loaded).kind,'admin');a.deepEqual(JSON.parse(fs.readFileSync(file)),original);
 const {createApp}=require('../device/lib/app'),{EventEmitter}=require('events');
 const app=createApp({bridge:new EventEmitter(),config:loaded});t.after(()=>app.close());
 a.ok(await app.listen(0)>0);
});
test('admin tokens expire and password rotation invalidates them without exposing a password hash',()=>{
 const {adminToken}=require('../device/lib/access');const payload=adminToken(cfg),token=sign(payload,cfg.secret);
 const resolve=(token,c=cfg)=>identify({cookie:'st_id='+token},c);
 a.equal(resolve(token).kind,'admin');a.equal(resolve(token,{...cfg,adminPassword:'new-password'}).kind,'none');
 a.equal(resolve(token,{...cfg,adminPassword:'new-password',accessEnabled:false}).kind,'open');
 for(const exp of [Date.now()-1,0,undefined,'forever'])a.equal(resolve(sign({...payload,exp},cfg.secret)).kind,'none');
 a.equal(resolve(sign({kind:'admin'},cfg.secret)).kind,'none');
 a.notEqual(payload.v,require('crypto').createHash('sha256').update(cfg.adminPassword).digest('hex'));
});

test('damaged config gets one recovery copy which survives later loads and settings saves',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'backup-access-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'config.json');
 const bytes='{"password":"original-band","members":[{"name":"Keep me"}],';fs.writeFileSync(file,bytes);
 const first=loadConfig(file);a.deepEqual(first.configWarning,{backupAvailable:true});a.equal(fs.readFileSync(file+'.damaged','utf8'),bytes);
 fs.writeFileSync(file,'another damaged version');loadConfig(file);a.equal(fs.readFileSync(file+'.damaged','utf8'),bytes);
 require('../device/lib/config').saveConfig({...normalizeAccess(first),password:'replacement'},file);
 a.equal(fs.readFileSync(file+'.damaged','utf8'),bytes);a.equal(JSON.parse(fs.readFileSync(file)).password,'replacement');
 a.equal(loadConfig(file).configWarning,undefined);
});
test('damaged access fields get backed up and a failed backup never stops config loading',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'backup-failure-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'config.json');
 const bytes=JSON.stringify({port:8765,username:'band',password:'keep',members:'broken',accessEnabled:true});fs.writeFileSync(file,bytes);
 const copy=fs.copyFileSync;fs.copyFileSync=()=>{throw Object.assign(new Error('read-only'),{code:'EACCES'});};
 let loaded;try{a.doesNotThrow(()=>{loaded=loadConfig(file);});}finally{fs.copyFileSync=copy;}
 a.deepEqual(loaded.configWarning,{backupAvailable:false});a.equal(loaded.password,'keep');a.equal(loaded.accessEnabled,true);a.equal(fs.readFileSync(file,'utf8'),bytes);
 loaded=loadConfig(file);a.equal(loaded.configWarning.backupAvailable,true);a.equal(fs.readFileSync(file+'.damaged','utf8'),bytes);
});
