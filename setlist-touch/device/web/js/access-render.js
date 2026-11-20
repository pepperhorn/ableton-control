import {createPlayerRenderer} from './player-render.js';
import {showPicker} from './access-view.js';
const $ = s => document.querySelector(s);
function el(tag, cls, text) { const node = document.createElement(tag); node.className = cls; if (text !== undefined) node.textContent = text; return node; }
export function createAccessRenderer({meOf, mixOf, refresh, status}) {
  const playerUI = createPlayerRenderer({refresh:async () => { loaded = false; await refresh(); }});
  let draft = [], loaded = false, dismissed = false, requested = false;
  // The Live jweb panel loads the loopback URL; never auto-prompt its operator.
  const local = /^(?:localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/i.test(location.hostname);
  try { dismissed = localStorage.getItem('st.pickerDismissed') === '1'; } catch (_) {}
  async function post(route, body) {
    const res = await fetch(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if (!res.ok) throw new Error(await res.text());
    return res;
  }
  async function act(fn) { try { await fn(); } catch (e) { status(e.message); } }
  function picker() {
    const me = meOf(), panel = $('.name-picker'); panel.hidden = location.hash === '#admin' || location.hash === '#settings' || !showPicker(me,dismissed,{local,requested});
    $('.name-dismiss').hidden = me.kind === 'none';
    $('.member-name').textContent = me.name || '';
    $('.member-logout').hidden = !me.name;
    const list = $('.name-choices'); list.replaceChildren();
    for (const m of me.members) {
      const button = el('button','name-choice',m.name); button.type = 'button';
      button.onclick = () => act(async () => { await post('/api/identify',{memberId:m.id}); requested = false; await refresh(); }); list.append(button);
    }
    $('.name-admin').hidden = !me.adminAvailable;
    $('.change-name').hidden = !!me.name || me.kind === 'none';
    $('.access-admin-link').hidden = me.kind !== 'admin' && !me.adminAvailable;
  }
  function renderMembers() {
    const list = $('.admin-members'); list.replaceChildren();
    for (const member of draft) {
      const row = el('fieldset','admin-member'), title = el('legend','admin-member-title',member.name);
      const name = el('input','admin-member-name'); name.value = member.name; name.setAttribute('aria-label','Member name');
      name.oninput = () => { member.name = name.value; title.textContent = name.value; };
      row.append(title,name);
      if (member.link) {
        const wrap = el('div','member-link'), link = el('input','member-link-url');
        link.readOnly = true; link.value = member.url || location.origin + member.link; link.setAttribute('aria-label',member.name + ' personal link');
        const copy = el('button','member-link-copy','Copy link'); copy.type = 'button';
        copy.onclick = async () => {
          try { if (!navigator.clipboard) throw Error(); await navigator.clipboard.writeText(link.value); status('Link copied.'); }
          catch (_) { link.focus(); link.select(); status('Link selected. Copy it from the text field.'); }
        };
        wrap.append(link,copy); row.append(wrap);
      }
      function permission(label, key, value, orphan = false) {
        const wrap = el('label',orphan ? 'admin-permission admin-orphan' : 'admin-permission');
        const input = el('input','admin-permission-check'); input.type = 'checkbox'; input.checked = member[key].includes(value);
        input.onchange = () => { member[key] = input.checked ? [...member[key],value] : member[key].filter(v => v !== value); };
        wrap.append(input,document.createTextNode(label)); row.append(wrap);
      }
      for (const page of ['monitor','scenes','transport']) permission(page === 'scenes' ? 'Can launch scenes' : page,'pages',page);
      const names = mixOf().returns.map(r => r.name);
      for (const name of names) permission('Mix: ' + name,'mixes',name);
      for (const name of member.mixes.filter(n => !names.includes(n))) permission('Missing return: ' + name,'mixes',name,true);
      const remove = el('button','admin-remove','Remove'); remove.type = 'button'; remove.onclick = () => { draft = draft.filter(m => m !== member); renderMembers(); };
      row.append(remove); list.append(row);
    }
  }
  async function admin() {
    const show = location.hash === '#admin' && meOf().kind === 'admin'; $('.admin-page').hidden = !show; playerUI.render(show);
    $('.admin-login').hidden = location.hash !== '#admin' || show || !meOf().adminAvailable;
    if (!show) { loaded = false; return; }
    if (loaded) return;
    const res = await fetch('/api/members'); if (!res.ok) throw new Error('Could not load members');
    draft = (await res.json()).map(({id,name,pages,mixes,link,url}) => ({id,name,pages,mixes,link,url})); loaded = true; renderMembers();
  }
  $('.change-name').onclick = () => { requested = true; picker(); };
  $('.name-dismiss').onclick = () => { if (meOf().kind === 'none') return; requested = false; dismissed = true; try { localStorage.setItem('st.pickerDismissed','1'); } catch (_) {} picker(); };
  $('.member-logout').onclick = () => act(async () => {
    await post('/api/forget',{}); location.hash = ''; location.reload();
  });
  $('.admin-login-form').onsubmit = e => { e.preventDefault(); act(async () => {
    await post('/api/admin-login',{password:e.currentTarget.elements.password.value}); $('.admin-login-form').reset(); await refresh();
  }); };
  $('.admin-add-form').onsubmit = e => {
    e.preventDefault(); const name = e.currentTarget.elements.name.value.trim(); if (!name) return;
    draft.push({name,pages:['monitor'],mixes:mixOf().returns.map(r => r.name).filter(r => r.toLowerCase() === name.toLowerCase())});
    e.currentTarget.reset(); renderMembers();
  };
  $('.admin-save').onclick = () => act(async () => { await post('/api/members',{members:draft}); loaded = false; await refresh(); status('Members saved.'); });
  return {render() { picker(); act(admin); },invalidate() { loaded = false; }};
}
