const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseSet}=require('../device/lib/parse-set');
const S=(index,name,extra={})=>({index,name,color:0,loopBeats:null,beatsPerBar:4,...extra});
test('songs, categories and stripped titles',()=>{
 const p=parseSet([S(0,'* [[ DINNER ]]'),S(1,'* RISE >>'),S(2,'READY'),S(3,'[N32] AA'),S(4,''),S(5,''),S(6,'* HOW DEEP >>'),S(7,'COUNT IN')]);
 assert.deepEqual(p.categories,['DINNER']);
 assert.deepEqual(p.songs.map(s=>[s.id,s.title,s.category]),[[1,'RISE >>','DINNER'],[6,'HOW DEEP >>','DINNER']]);
 assert.deepEqual(p.songs[0].rows.map(r=>[r.sceneIndex,r.isEnd]),[[2,false],[3,false],[4,true]]);
 assert.equal(p.sceneToSong[3],1);assert.equal(p.sceneToSong[5],undefined);
});
test('mid-song empty kept',()=>assert.deepEqual(parseSet(['* A','X','','Y'].map((n,i)=>S(i,n))).songs[0].rows.map(r=>r.isEnd),[false,true,false]));
test('scenes before first song ignored; uncategorised songs',()=>{const p=parseSet(['X','* A','Y'].map((n,i)=>S(i,n)));assert.equal(p.songs[0].category,null);assert.equal(p.sceneToSong[0],undefined);});
test('category scene ends current song',()=>{const p=parseSet(['* A','X','* [[ B ]]','ignored','* C'].map((n,i)=>S(i,n)));assert.equal(p.songs[0].rows.length,1);assert.equal(p.songs[1].category,'B');});
test('duplicate titles get occurrence 1 and 2',()=>assert.deepEqual(parseSet(['* A','X','* A','Y'].map((n,i)=>S(i,n))).songs.map(s=>s.occurrence),[1,2]));
test('whitespace empty; *NoSpace is a section',()=>{const p=parseSet(['* A','*NoSpace','  '].map((n,i)=>S(i,n)));assert.equal(p.songs.length,1);assert.equal(p.songs[0].rows[1].isEnd,true);assert.equal(p.songs[0].rows[0].name,'*NoSpace');});
test('fixture-rise has four songs and RISE has 11 rows ending in End',()=>{const p=parseSet(require('../device/lib/fixture-rise.json'));assert.equal(p.songs.length,4);const r=p.songs.find(s=>s.title==='RISE >>');assert.equal(r.rows.length,11);assert.equal(r.rows[10].isEnd,true);});
