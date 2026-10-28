export function initialMixState(prefs = {}) {
  return {page:prefs.page === 'mix' ? 'mix' : 'scenes', tab:typeof prefs.tab === 'string' ? prefs.tab : null};
}
export function reduceMix(state, action, mix) {
  switch (action.type) {
    case 'page': return {...state, page:action.page === 'mix' ? 'mix' : 'scenes'};
    case 'tab': return mix.returns.some(r => r.name === action.name) ? {...state, tab:action.name} : state;
    case 'mix': return {...state, tab:mix.returns.some(r => r.name === state.tab) ? state.tab : (mix.returns[0] || {}).name || null};
    default: return state;
  }
}
// Keep remote levels underneath a drag, then hold the committed release until
// its next echo or a bounded timeout. A later drag always wins on this screen.
export function faderValue(level, dragging, committed) { return dragging || committed || level; }
export function createFaderHolds({onExpire, timeoutMs = 1000, setTimer = setTimeout, clearTimer = clearTimeout}) {
  const holds = new Map();
  function echo(key) {
    const entry = holds.get(key);
    if (entry) { clearTimer(entry.timer); holds.delete(key); }
  }
  return {
    commit(key, level) {
      echo(key);
      const entry = {level};
      entry.timer = setTimer(() => {
        if (holds.get(key) !== entry) return;
        holds.delete(key); onExpire();
      }, timeoutMs);
      holds.set(key, entry);
    },
    echo,
    get(key) { return holds.has(key) ? holds.get(key).level : null; },
    clear() { for (const key of holds.keys()) echo(key); }
  };
}
export function valueLabel(level) {
  if (level.label) return level.label;
  // Fallback only: Live's taper may differ. Keep the approximation visible.
  return level.value === 0 ? '-inf dB' : `≈ ${(20 * Math.log10(level.value)).toFixed(1)} dB`;
}
