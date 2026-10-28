import {test} from 'node:test';import a from 'node:assert/strict';import {fitRows} from '../device/web/js/layout.js';
test('fitting, scrolling, max and empty',()=>{a.deepEqual(fitRows(10,700),{rowHeight:64.6,scroll:false});a.deepEqual(fitRows(10,300),{rowHeight:44,scroll:true});a.deepEqual(fitRows(3,900),{rowHeight:120,scroll:false});a.deepEqual(fitRows(0,500),{rowHeight:120,scroll:false});});
