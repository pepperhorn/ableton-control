import {test} from 'node:test';
import assert from 'node:assert/strict';
import {noSongsMessage} from '../device/web/js/timing-view.js';
test('no songs message requires a received empty set, connection and completed indexing',()=>{
 for(const connected of [true,false])for(const receivedEmpty of [true,false])for(const indexing of [true,false]) {
  assert.equal(noSongsMessage({connected,receivedEmpty,indexing}),connected && receivedEmpty && !indexing ? 'No songs found. Name a scene "* Song title".' : null);
 }
});
