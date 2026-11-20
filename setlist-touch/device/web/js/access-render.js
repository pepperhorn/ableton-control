import {sourceLabel} from './x32-view.js';
import {createPlayerRenderer} from './player-render.js';
import {showPicker} from './access-view.js';
const $ = s => document.querySelector(s);
function el(tag, cls, text) { const node = document.createElement(tag); node.className = cls; if (text !== undefined) node.textContent = text; return node; }
export function createAccessRenderer({meOf, mixOf, x32Of, refresh, status}) {
  const playerUI = createPlayerRenderer({refresh:async () => { loaded = false; await refresh(); }});
  let busSignature='', draft = [], loaded = false, dismissed = false, requested = false;
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
  function renderBusControls(row,member) {
    const state=x32Of(),group=el('div','admin-buses');
    group.append(el('strong','admin-bus-heading','X32 buses (first selected is own bus)'));
    const linked=new Set((state.buses || []).filter(b=>b.linked).map(b=>b.bus));
    for(let n=1;n<=16;n++) {
      if(linked.has(n-1))continue;
      const b=state.buses.find(b=>b.bus===n),wrap=el('label','admin-permission'),input=el('input','admin-permission-check');input.type='checkbox';
      input.checked=member.buses.includes(n) || linked.has(n) && member.buses.includes(n+1);
      input.onchange=()=>{member.buses=member.buses.filter(v=>v!==n && !(linked.has(n) && v===n+1));if(input.checked)member.buses.push(n);renderMembers();};
      wrap.append(input,document.createTextNode(`Bus ${n}${linked.has(n)?'/'+(n+1):''}${b?.name?' · '+b.name:''}`));group.append(wrap);
    }
    row.append(group);
    const assigned=state.buses.filter(b=>member.buses.includes(b.bus) || b.linked && member.buses.includes(b.bus+1));
    for(const b of assigned.filter(b=>b.toMain))row.append(el('p','admin-bus-warning',`Bus ${b.bus} is routed to Main LR`));
    const details=el('details','admin-hidden'),summary=el('summary','admin-hidden-title',"Member's hidden strips");details.append(summary);row.append(details);
    details.ontoggle=async()=>{
      if(!details.open || !member.id || details.dataset.loaded)return;
      details.dataset.loaded='1';
      try {
        const res=await fetch('/api/x32?member='+encodeURIComponent(member.id));if(!res.ok)throw Error();const personal=await res.json();
        const select=el('select','admin-hidden-bus');select.setAttribute('aria-label','Hidden list bus');
        // With access off a member can view every bus and keep a personal list for each.
        const buses=meOf().accessEnabled ? assigned : personal.buses;
        for(const b of buses){const o=el('option','admin-hidden-option',b.name || `Bus ${b.bus}`);o.value=b.bus;select.append(o);}
        const list=el('div','admin-hidden-list'),save=el('button','admin-hidden-save','Save hidden list');save.type='button';
        function paint(){list.replaceChildren();const hidden=personal.hidden[select.value] || [];for(const source of personal.sources){const label=el('label','admin-permission'),check=el('input','admin-hidden-check');check.type='checkbox';check.checked=hidden.includes(source.id);check.dataset.source=source.id;label.append(check,document.createTextNode(sourceLabel(source)));list.append(label);}}
        select.onchange=paint;save.disabled=!buses.length;
        save.onclick=()=>act(async()=>{const hidden=[...list.querySelectorAll('input:checked')].map(n=>n.dataset.source);const res=await fetch('/api/x32-hidden',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({member:member.id,bus:Number(select.value),hidden})});if(!res.ok)throw Error(await res.text());member.hidden[select.value]=hidden;personal.hidden[select.value]=hidden;status('Hidden list saved.');});
        details.append(el('p','admin-hidden-hint','Checked sources are hidden. Save members before editing a newly assigned bus.'),select,list,save);paint();
      }catch(_){details.append(el('p','admin-hidden-error','Could not load hidden lists.'));delete details.dataset.loaded;}
    };
  }
  async function loadX32Settings() {
    const res=await fetch('/api/x32-settings');if(!res.ok)throw Error('Could not load X32 settings');const cfg=await res.json(),form=$('.admin-x32-settings');
    form.elements.mixSource.value=cfg.mixSource;form.elements.host.value=cfg.host || '';form.elements.host.placeholder=cfg.lastHost || 'Automatic discovery';
  }
  $('.admin-x32-settings').onsubmit=e=>{e.preventDefault();const form=e.currentTarget;act(async()=>{const res=await fetch('/api/x32-settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({mixSource:form.elements.mixSource.value,host:form.elements.host.value.trim() || null})});if(!res.ok)throw Error(await res.text());await refresh();status('Mix settings saved.');});};
  const currentBusSignature=()=>JSON.stringify((x32Of().buses || []).map(({bus,name,linked,toMain})=>({bus,name,linked,toMain})));
  function renderMembers() {
    busSignature=currentBusSignature();
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
      if(meOf().mixSource==='x32')renderBusControls(row,member);
      const names = mixOf().returns.map(r => r.name);
      for (const name of meOf().mixSource==='x32' ? [] : names) permission('Mix: ' + name,'mixes',name);
      for (const name of member.mixes.filter(n => meOf().mixSource!=='x32' && !names.includes(n))) permission('Missing return: ' + name,'mixes',name,true);
      const remove = el('button','admin-remove','Remove'); remove.type = 'button'; remove.onclick = () => { draft = draft.filter(m => m !== member); renderMembers(); };
      row.append(remove); list.append(row);
    }
  }
  async function admin() {
    const show = location.hash === '#admin' && meOf().kind === 'admin'; $('.admin-page').hidden = !show; playerUI.render(show && meOf().mixSource!=='x32');
    $('.admin-login').hidden = location.hash !== '#admin' || show || !meOf().adminAvailable;
    if (!show) { loaded = false; return; }
    const xs=x32Of().status || {};$('.admin-x32-status').textContent=`X32: ${xs.state || 'searching'}${xs.host?' · '+xs.host:''}${xs.name?' · '+xs.name:''}`;
    if (loaded) {if(busSignature!==currentBusSignature())renderMembers();return;}
    await loadX32Settings();
    const res = await fetch('/api/members'); if (!res.ok) throw new Error('Could not load members');
    draft = (await res.json()).map(({id,name,pages,mixes,link,url,buses=[],hidden={}}) => ({id,name,pages,mixes,link,url,buses,hidden})); loaded = true; renderMembers();
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
    draft.push({name,buses:[],hidden:{},pages:['monitor'],mixes:mixOf().returns.map(r => r.name).filter(r => r.toLowerCase() === name.toLowerCase())});
    e.currentTarget.reset(); renderMembers();
  };
  $('.admin-save').onclick = () => act(async () => { const res=await post('/api/members',{members:draft});const result=await res.json();loaded = false; await refresh(); status(result.warning || 'Members saved.'); });
  return {render() { picker(); act(admin); },invalidate() { loaded = false; }};
}
