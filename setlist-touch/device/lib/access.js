'use strict';
const crypto = require('crypto');
const pages = ['monitor','scenes','transport'];
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
function validMembers(members) {
  return Array.isArray(members) && members.length <= 100 && members.every(m => m && text(m.id) && text(m.name) &&
    Array.isArray(m.pages) && m.pages.every(p => pages.includes(p)) && Array.isArray(m.mixes) && m.mixes.every(text)) &&
    new Set(members.map(m => m.id)).size === members.length;
}
function normalizeAccess(cfg) {
  const absent = cfg.accessEnabled === undefined && cfg.members === undefined;
  const valid = typeof cfg.accessEnabled === 'boolean' && validMembers(cfg.members);
  return {...cfg, accessEnabled:absent ? false : valid ? cfg.accessEnabled : true,
    members:valid ? cfg.members : [], adminPassword:typeof cfg.adminPassword === 'string' ? cfg.adminPassword : '',
    secret:typeof cfg.secret === 'string' && /^[a-f0-9]{64}$/.test(cfg.secret) ? cfg.secret : crypto.randomBytes(32).toString('hex')};
}
function equal(a, b) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x,y); }
function sign(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return data + '.' + crypto.createHmac('sha256', secret).update(data).digest('base64url');
}
function verify(token, secret) {
  try {
    if (typeof token !== 'string' || token.length > 2048) return null;
    const [data, mac, extra] = token.split('.');
    if (!data || !mac || extra !== undefined || !equal(mac,crypto.createHmac('sha256',secret).update(data).digest('base64url'))) return null;
    return JSON.parse(Buffer.from(data,'base64url').toString());
  } catch (_) { return null; }
}
function adminVersion(cfg) { return crypto.createHmac('sha256',cfg.secret).update('admin-password\0').update(cfg.adminPassword).digest('hex'); }
function adminToken(cfg) { return {kind:'admin',v:adminVersion(cfg),exp:Date.now() + 31536000000}; }
const MEMBER_AGE = 86400000;
function memberToken(member, now = Date.now()) { return {kind:'member',memberId:member.id,exp:now + MEMBER_AGE}; }
function slugFor(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function reservedSlug(slug) {
  const routes = ['', 'admin','api','js','css','fonts','settings','diagnostic','touch-test'];
  return routes.includes(slug) || require('fs').readdirSync(require('path').join(__dirname,'../web')).some(name => name === slug || slugFor(name) === slug);
}
function validSlugs(members) {
  const slugs = members.map(m => slugFor(m.name));
  return slugs.every(s => !reservedSlug(s)) && new Set(slugs).size === slugs.length;
}
function identify({trusted, cookie, now = Date.now()}, cfg) {
  const read = name => {
    const value = (cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(name+'='));
    return verify(value && value.slice(name.length+1),cfg.secret);
  };
  const payload = read('st_id');
  const memberOf = p => p && p.kind === 'member' && Number.isSafeInteger(p.exp) && p.exp > now && cfg.members.find(m => m.id === p.memberId);
  const admin = trusted || payload && payload.kind === 'admin' && cfg.adminPassword && typeof payload.v === 'string' &&
    Number.isSafeInteger(payload.exp) && payload.exp > now && equal(payload.v,adminVersion(cfg));
  const member = (admin ? memberOf(read('st_who')) || memberOf(payload) : memberOf(payload)) || (cfg.accessEnabled === false && memberOf(read('st_who')));
  if (admin) return member ? {kind:'admin',member} : {kind:'admin'};
  if (cfg.accessEnabled === false) return member ? {kind:'open',member} : {kind:'open'};
  return member ? {kind:'member',member} : {kind:'none'};
}
function can(identity, action, returnName) {
  if (identity.kind === 'admin' || identity.kind === 'open') return true;
  if (identity.kind !== 'member') return false;
  if (action === 'send') return identity.member.mixes.includes(returnName);
  return identity.member.pages.includes({fire:'scenes',transport:'transport'}[action]);
}
function meFor(identity, cfg) {
  const full = identity.kind === 'admin' || identity.kind === 'open';
  return {accessEnabled:cfg.accessEnabled, kind:identity.kind, name:identity.member ? identity.member.name : null, link:identity.member ? '/' + slugFor(identity.member.name) : null,
    pages:full ? pages : identity.member ? identity.member.pages : ['monitor'],
    mixes:full ? 'all' : identity.member ? identity.member.mixes : [],
    members:cfg.members.map(({id,name}) => ({id,name})),adminAvailable:!!cfg.adminPassword};
}
function newMember(name, returnNames) {
  return {id:crypto.randomBytes(16).toString('hex'),name,pages:['monitor'],mixes:returnNames.filter(r => r.toLowerCase() === name.toLowerCase())};
}
function checkAdminPassword(given, cfg) { return !!cfg.adminPassword && typeof given === 'string' && equal(given,cfg.adminPassword); }
module.exports = {memberToken,slugFor,reservedSlug,validSlugs,adminToken,validMembers,normalizeAccess,sign,verify,identify,can,meFor,newMember,checkAdminPassword};

// Return lookup only; stored permission names remain the exact Live readback.
function matchReturn(returns, name) {
  const trim = value => value.trim(), normalized = value => trim(value).replace(/^[A-L][- ]/, '');
  const exact = returns.filter(r => trim(r.name) === trim(name));
  const matches = exact.length ? exact : returns.filter(r => normalized(r.name) === name.trim());
  if (matches.length > 1) throw Error('More than one return has that name');
  return matches[0] || null;
}
module.exports.matchReturn = matchReturn;
