'use strict';
// A literal plus AND space is the opt-in. +Kick (or +<tab>Kick) is excluded.
function parseMix(raw = {}) {
  const returns = (raw.returns || []).filter(r => r.routedToMain === false)
    .map(r => ({returnIndex:r.index, name:r.name, color:r.color}));
  const strips = (raw.tracks || []).filter(t => typeof t.name === 'string' && t.name.startsWith('+ '))
    .map(t => {
      const levels = {};
      for (const r of returns) {
        const level = (t.sends || [])[r.returnIndex];
        if (level && typeof level.value === 'number' && Number.isFinite(level.value) && level.value >= 0 && level.value <= 1)
          levels[r.returnIndex] = {value:level.value, label:typeof level.label === 'string' ? level.label : ''};
      }
      return {trackIndex:t.index, rawName:t.name, name:t.name.slice(2), color:t.color, levels};
    });
  return {returns, strips};
}
module.exports = {parseMix};
