import {test} from 'node:test';
import a from 'node:assert/strict';
import {createHoldGesture} from '../device/web/js/hold.js';
test('early release and cancelled pointers never complete', () => {
  const h = createHoldGesture(); h.down(1, 0);
  a.equal(h.progress(500), 0.5); a.equal(h.up(1, 999), false); a.equal(h.progress(1000), 0);
  h.down(2, 1000); h.cancel(2); a.equal(h.up(2, 3000), false);
});
test('1000 milliseconds completes once, including completion before release', () => {
  const h = createHoldGesture(); h.down(1, 20);
  a.equal(h.progress(0), 0); a.equal(h.progress(2000), 1);
  a.equal(h.up(1, 1020), true); a.equal(h.up(1, 2000), false);
});
test('second pointer cancels both and does not rearm the remaining finger', () => {
  const h = createHoldGesture(); h.down(1, 0); h.down(2, 500);
  a.equal(h.progress(1000), 0); a.equal(h.up(2, 1500), false); a.equal(h.up(1, 2000), false);
  h.down(3, 3000); a.equal(h.up(3, 4000), true);
});
test('leaving the button permanently cancels this hold, even after reentry', () => {
  const h = createHoldGesture(); h.down(1, 0); h.move(99, false);
  a.equal(h.progress(400), 0.4); h.move(1, false); h.move(1, true);
  a.equal(h.up(1, 1200), false);
});
