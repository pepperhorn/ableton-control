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
  const effects = (raw.effects || []).filter(e => (raw.returns || []).some(r => r.index === e.index && r.routedToMain === true && r.name === e.name)).map(e => {
    const levels = {};
    for (const r of returns) { const l = (e.sends || {})[r.returnIndex]; if (l && Number.isFinite(l.value) && l.value >= 0 && l.value <= 1) levels[r.returnIndex] = {value:l.value,label:typeof l.label === 'string' ? l.label : ''}; }
    return {effectIndex:e.index,rawName:e.name,name:e.name,color:e.color,levels};
  });
  return effects.length ? {returns, strips, effects} : {returns, strips};
}
module.exports = {parseMix};
