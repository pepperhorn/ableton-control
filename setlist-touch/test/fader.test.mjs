import {test} from 'node:test';
import a from 'node:assert/strict';
import {createFaderGesture} from '../device/web/js/fader.js';
const create = () => createFaderGesture({fullScalePx:400});
test('tap never changes a send, even away from the current fill',()=>{
 const f=create();a.equal(f.down(1,300,20,0.5),undefined);a.equal(f.move(1,304,22),null);a.equal(f.up(1),null);
});
test('vertical-first and ambiguous diagonal gestures remain scrolling',()=>{
 for(const first of [[2,9],[10,10]]){const f=create();f.down(1,0,0,0.5);a.equal(f.move(1,...first),null);a.equal(f.move(1,100,10),null);a.equal(f.up(1),null);}
});
test('horizontal slide is relative, clamps and releases its final value',()=>{
 const f=create();f.down(1,200,0,0.5);a.equal(f.move(1,300,0),0.75);a.equal(f.move(1,500,20),1);a.equal(f.move(1,-100,40),0);a.equal(f.up(1),0);
});
test('second pointer cancels until all pointers lift; cancellation and wrong pointer do not write',()=>{
 const f=create();f.down(1,0,0,0.5);f.down(2,20,0,0.6);a.equal(f.move(1,100,0),null);a.equal(f.up(2),null);a.equal(f.move(1,100,0),null);a.equal(f.up(1),null);
 f.down(3,0,0,0.5);a.equal(f.move(9,100,0),null);a.equal(f.move(3,100,0),0.75);f.cancel(3);a.equal(f.up(3),null);
 f.down(4,0,0,0.5);a.equal(f.move(4,100,0),0.75);
});
