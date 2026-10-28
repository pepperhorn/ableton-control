const {test} = require('node:test');
const a = require('node:assert/strict');
const {parseMix} = require('../device/lib/parse-mix');
const fixture = require('../device/lib/fixture-mix.json');
test('mix keeps external returns and tagged tracks in set order, retaining raw names', () => {
  const mix = parseMix(fixture);
  a.deepEqual(mix.returns.map(r => r.name), ['Shaun','Keith','Sam']);
  a.deepEqual(mix.strips.map(s => s.trackIndex), fixture.tracks.map(t => t.index));
  a.equal(mix.strips[0].name, 'DRUMS'); a.equal(mix.strips[0].rawName, '+ DRUMS');
  a.deepEqual(mix.strips[0].levels[2], fixture.tracks[0].sends[2]);
  a.equal(mix.strips[0].levels[0], undefined);
});
test('strict opt-in excludes +Kick, tab, ordinary tracks and unknown routing', () => {
  const mix = parseMix({returns:[...fixture.returns, {index:5,name:'Unknown'}], tracks:[
    ...fixture.tracks, ...['+Kick','+\tKick','Kick'].map(name => ({index:99,name,sends:[]}))]});
  a.equal(mix.strips.length,10); a.equal(mix.returns.length,3);
  a.deepEqual(parseMix(),{returns:[],strips:[]});
});
