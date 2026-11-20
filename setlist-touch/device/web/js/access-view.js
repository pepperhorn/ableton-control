export function allowedPages(me, mix = null) {
  if (me.kind === 'admin' || me.kind === 'open') return ['scenes','mix','monitor'];
  const pages = ['scenes','mix','monitor'].filter(p => p === 'mix' ? (me.mixSource === 'x32' ? me.kind !== 'none' : (mix && mix.returns.length ? allowedTabs(mix,me).length > 0 : me.mixes.length > 0)) : me.pages.includes(p));
  return pages.length ? pages : ['monitor'];
}
export function pageFor(page, me, mix = null) { const pages = allowedPages(me,mix); return pages.includes(page) ? page : pages[0]; }
export function allowedTabs(mix, me) { return mix.returns.filter(r => me.mixes === 'all' || me.mixes.includes(r.name)); }
export function showPicker(me, dismissed = false, {local = false, requested = false} = {}) { return !me.name && (me.kind === 'none' || requested || (!local && !dismissed && me.members?.length > 0)); }
