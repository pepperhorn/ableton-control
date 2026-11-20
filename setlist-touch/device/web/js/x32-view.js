export function x32Db(v) {
  if (!v) return '-inf dB';
  return ((v>=0.5 ? v*40-30 : v>=0.25 ? v*80-50 : v>=0.0625 ? v*160-70 : v*480-90)).toFixed(1)+' dB';
}
export function sourceLabel(s) { return s.name?.trim() || (s.kind==='ch' ? `Ch ${String(s.number).padStart(2,'0')}` : s.kind==='auxin' ? `Aux ${s.number}` : `FX ${s.number}`); }
export function x32Tabs(state) { return state.buses || []; } // Server already orders the member's own bus first.
export function x32Message(state, bus) {
  if (state.status?.state !== 'connected') return state.status?.state === 'searching' ? 'Searching for X32…' : 'X32 not connected';
  if (bus && (state.unavailableBuses || []).includes(bus)) return `Bus ${bus} not available`;
  return !state.buses?.length ? 'No mix bus assigned' : '';
}
export function x32Strips(state, bus) {
  const b=state.buses?.find(b=>b.bus===bus); if (!b) return [];
  const saved=state.hidden?.[bus], disabled=state.status?.state !== 'connected';
  const level=(source,value)=>{const l=state.levels?.[bus]?.[source];return {value:l?.value ?? value ?? 0,db:l?.label || x32Db(l?.value ?? value ?? 0)};};
  const strips=(state.sources || []).slice().sort((a,b)=>['ch','auxin','fxrtn'].indexOf(a.kind)-['ch','auxin','fxrtn'].indexOf(b.kind) || a.number-b.number).map(s=>({source:s.id,label:sourceLabel(s),color:s.color,...level(s.id,b.sends?.[s.id]),hidden:saved ? saved.includes(s.id) : !!s.unnamed || !s.name?.trim(),disabled}));
  return [{source:'master',label:b.name?.trim() || `Bus ${bus}`,color:b.color,...level('master',b.master),hidden:false,sticky:true,disabled},...strips.filter(s=>!s.hidden),...strips.filter(s=>s.hidden)];
}
export const deskPalette=['#666976','#ef5555','#43c779','#e6c84b','#648df5','#d96bdf','#50ced4','#eeeeee'];
