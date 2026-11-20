'use strict';
const {test} = require('node:test');
const a = require('node:assert/strict');
const {encode, decode} = require('../device/lib/osc');
test('osc round-trips s/i/f and padding', () => {
  const packet = encode('/test', ['abcd', {type:'i', value:-17}, 0.75, {type:'f', value:0.5}, {type:'s', value:'é'}]);
  a.equal(packet.length % 4, 0);
  a.deepEqual(decode(packet), {address:'/test', args:['abcd', -17, 0.75, 0.5, 'é']});
  a.deepEqual(decode(encode('/xinfo', [])), {address:'/xinfo', args:[]});
  a.equal(encode('/a', [1]).subarray(4, 8).toString(), ',f\0\0');
});
test('decode returns null on truncated packet', () => {
  const packet = encode('/test', ['hello', 0.5]);
  for (let n = 0; n < packet.length; n++) a.equal(decode(packet.subarray(0, n)), null);
});
test('decode rejects malformed padding, tags, values and trailing bytes without throwing', () => {
  for (const input of [null, 'bad', Buffer.alloc(0), Buffer.from('/x\0x,s\0\0hi\0\0'), Buffer.from('/x\0\0,z\0\0'), Buffer.from('#bundle\0'), Buffer.concat([encode('/x', []), Buffer.alloc(4)]), encode('/x', [{type:'f', value:Infinity}])]) a.equal(decode(input), null);
  a.throws(() => encode('/x', ['a\0b']));
});
