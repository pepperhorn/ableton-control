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
// Remote levels keep updating beneath the local drag, ready for release.
export function faderValue(level, dragging) { return dragging || level; }
export function valueLabel(level) {
  if (level.label) return level.label;
  // Fallback only: Live's taper may differ. Keep the approximation visible.
  return level.value === 0 ? '-inf dB' : `≈ ${(20 * Math.log10(level.value)).toFixed(1)} dB`;
}
