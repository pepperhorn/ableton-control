export function allowedPages(me) {
  if (me.kind === 'admin' || me.kind === 'open') return ['scenes','mix','monitor'];
  const pages = ['scenes','mix','monitor'].filter(p => p === 'mix' ? me.mixes.length > 0 : me.pages.includes(p));
  return pages.length ? pages : ['monitor'];
}
export function pageFor(page, me) { const pages = allowedPages(me); return pages.includes(page) ? page : pages[0]; }
export function allowedTabs(mix, me) { return mix.returns.filter(r => me.mixes === 'all' || me.mixes.includes(r.name)); }
export function showPicker(me) { return me.kind === 'none'; }
