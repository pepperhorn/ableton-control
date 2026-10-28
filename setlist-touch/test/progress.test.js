const {test}=require('node:test');const a=require('node:assert/strict');
const {beatsPerBar,progress}=require('../device/lib/progress');
test('signatures including 6/8',()=>{a.equal(beatsPerBar(4,4),4);a.equal(beatsPerBar(6,8),3);a.equal(beatsPerBar(3,4),3);});
test('progress, partial bars, clamps and invalid loops',()=>{
 a.deepEqual(progress({position:42,loopStart:0,loopEnd:128,beatsPerBar:4}),{bar:11,bars:32,fraction:42/128});
 a.deepEqual(progress({position:5,loopStart:0,loopEnd:6,beatsPerBar:4}),{bar:2,bars:1.5,fraction:5/6});
 for(const loopEnd of [0,null,NaN,Infinity])a.equal(progress({position:1,loopStart:0,loopEnd,beatsPerBar:4}),null);
 a.equal(progress({position:1,loopStart:4,loopEnd:4,beatsPerBar:4}),null);
 a.deepEqual(progress({position:200,loopStart:0,loopEnd:128,beatsPerBar:4}),{bar:32,bars:32,fraction:1});
 a.deepEqual(progress({position:1,loopStart:4,loopEnd:10,beatsPerBar:3}),{bar:1,bars:2,fraction:0});
});
