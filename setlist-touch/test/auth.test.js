const {test}=require('node:test');const a=require('node:assert/strict');
const {isLoopback,isTrustedLoopback,checkBasic,authorize}=require('../device/lib/auth');
const {DEFAULT_CONFIG,loadConfig,saveConfig,configPath}=require('../device/lib/config');
const fs=require('fs'),os=require('os'),path=require('path');
const cfg={username:'band',password:'pw'},hdr='Basic '+Buffer.from('band:pw').toString('base64');
test('loopback addresses only',()=>{for(const ip of ['127.0.0.1','127.2.3.4','::1','::ffff:127.0.0.1'])a.ok(isLoopback(ip));for(const ip of ['100.101.2.3','192.168.1.20','127.evil',undefined])a.ok(!isLoopback(ip));});
test('auth and malformed credentials',()=>{a.equal(authorize({remoteAddress:'127.0.0.1',host:'localhost:8765'},{...cfg,password:''}),'ok');a.equal(authorize({remoteAddress:'192.168.1.20',authorization:hdr},cfg),'ok');a.equal(authorize({remoteAddress:'100.64.0.9'},cfg),'challenge');a.equal(authorize({remoteAddress:'192.168.1.20',authorization:hdr},{...cfg,password:''}),'forbidden');for(const h of ['Basic !!!','Bearer x','Basic '+Buffer.from('band:nope').toString('base64'),undefined])a.ok(!checkBasic(h,cfg));});
test('loopback bypass requires an exact local Host hostname',()=>{
 for(const host of ['localhost','LOCALHOST:8765','127.0.0.1:8765','[::1]','[::1]:8765']) {
  a.ok(isTrustedLoopback('::ffff:127.0.0.1',host),host);
  a.equal(authorize({remoteAddress:'::1',host},{...cfg,password:''}),'ok');
  a.ok(!isTrustedLoopback('192.168.1.2',host));
 }
 for(const host of ['attacker.example:8765','localhost.evil','localhost@attacker.example','attacker.example@localhost','localhost/path','127.2.3.4','127.1','localhost:bad','[::1]:bad','http://localhost',undefined]) {
  a.ok(!isTrustedLoopback('127.0.0.1',host),String(host));
  a.equal(authorize({remoteAddress:'127.0.0.1',host},cfg),'challenge');
  a.equal(authorize({remoteAddress:'127.0.0.1',host,authorization:hdr},cfg),'ok');
  a.equal(authorize({remoteAddress:'127.0.0.1',host},{...cfg,password:''}),'forbidden');
 }
});
test('config missing, corrupt, roundtrip and default path',t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'setlist-config-'));t.after(()=>fs.rmSync(dir,{recursive:true}));const p=path.join(dir,'nested/config.json');a.deepEqual(loadConfig(p),DEFAULT_CONFIG);saveConfig(cfg,p);a.deepEqual(loadConfig(p),{...DEFAULT_CONFIG,...cfg});fs.writeFileSync(p,'broken');a.deepEqual(loadConfig(p),DEFAULT_CONFIG);a.equal(configPath(),path.join(os.homedir(),'Documents','SetlistTouch','config.json'));});
