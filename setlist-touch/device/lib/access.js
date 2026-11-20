'use strict';
const crypto = require('crypto');
const validBus = n => Number.isInteger(n) && n >= 1 && n <= 16;
const validSource = s => typeof s === 'string' && /^(ch\/(0[1-9]|[12][0-9]|3[0-2])|(?:auxin|fxrtn)\/0[1-8])$/.test(s);
const pages = ['monitor','scenes','transport'];
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
function validMembers(members) {
  return Array.isArray(members) && members.length <= 100 && members.every(m => m && text(m.id) && text(m.name) &&
    Array.isArray(m.pages) && m.pages.every(p => pages.includes(p)) && Array.isArray(m.mixes) && m.mixes.every(text) &&
    (m.buses === undefined || Array.isArray(m.buses) && m.buses.every(validBus)) &&
    (m.hidden === undefined || m.hidden && typeof m.hidden === 'object' && !Array.isArray(m.hidden) && Object.entries(m.hidden).every(([bus,ids]) => validBus(Number(bus)) && Array.isArray(ids) && ids.every(validSource)))) &&
    new Set(members.map(m => m.id)).size === members.length;
}
function normalizeAccess(cfg) {
  const absent = cfg.accessEnabled === undefined && cfg.members === undefined;
  const valid = typeof cfg.accessEnabled === 'boolean' && validMembers(cfg.members);
  return {...cfg, accessEnabled:absent ? false : valid ? cfg.accessEnabled : true,
    mixSource:cfg.mixSource || ((Array.isArray(cfg.members) ? cfg.members : []).some(m => m && Array.isArray(m.mixes) && m.mixes.length) ? 'ableton' : 'x32'), x32Host:cfg.x32Host || null,
    members:valid ? cfg.members.map(m => ({...m,buses:m.buses || [],hidden:m.hidden || {}})) : [], adminPassword:typeof cfg.adminPassword === 'string' ? cfg.adminPassword : '',
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
// Device web assets are static for the lifetime of this server process.
const reservedStaticSlugs = new Set(require('fs').readdirSync(require('path').join(__dirname,'../web')).flatMap(name => [name,slugFor(name)]));
const reservedRoutes = new Set(['', 'admin','api','js','css','fonts','settings','diagnostic','touch-test']);
function reservedSlug(slug) { return reservedRoutes.has(slug) || reservedStaticSlugs.has(slug); }
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
function can(identity, action, returnName, busFor = n => n) {
  if (identity.kind === 'admin' || identity.kind === 'open') return true;
  if (identity.kind !== 'member') return false;
  if (action === 'busSend') return (identity.member.buses || []).some(n => busFor(n) === busFor(returnName));
  if (action === 'send') return identity.member.mixes.includes(returnName);
  return identity.member.pages.includes({fire:'scenes',transport:'transport'}[action]);
}
function meFor(identity, cfg) {
  const full = identity.kind === 'admin' || identity.kind === 'open';
  return {accessEnabled:cfg.accessEnabled, kind:identity.kind, name:identity.member ? identity.member.name : null, link:identity.member ? '/' + slugFor(identity.member.name) : null,
    pages:full ? pages : identity.member ? identity.member.pages : ['monitor'],
    mixSource:cfg.mixSource, buses:full ? 'all' : identity.member ? identity.member.buses || [] : [],
    mixes:full ? 'all' : identity.member ? identity.member.mixes : [],
    members:cfg.members.map(({id,name}) => ({id,name})),adminAvailable:!!cfg.adminPassword};
}
function newMember(name, returnNames) {
  return {id:crypto.randomBytes(16).toString('hex'),name,pages:['monitor'],buses:[],hidden:{},mixes:returnNames.filter(r => r.toLowerCase() === name.toLowerCase())};
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
