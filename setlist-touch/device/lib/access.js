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
function identify({trusted, cookie}, cfg) {
  if (trusted) return {kind:'admin'};
  const token = (cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('st_id='));
  const payload = verify(token && token.slice(6),cfg.secret);
  if (payload && payload.kind === 'admin' && cfg.adminPassword) return {kind:'admin'};
  if (cfg.accessEnabled === false) return {kind:'open'};
  const member = payload && payload.kind === 'member' && cfg.members.find(m => m.id === payload.memberId);
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
  return {accessEnabled:cfg.accessEnabled, kind:identity.kind, name:identity.member ? identity.member.name : null,
    pages:full ? pages : identity.member ? identity.member.pages : ['monitor'],
    mixes:full ? 'all' : identity.member ? identity.member.mixes : [],
    members:cfg.members.map(({id,name}) => ({id,name})),adminAvailable:!!cfg.adminPassword};
}
function newMember(name, returnNames) {
  return {id:crypto.randomBytes(16).toString('hex'),name,pages:['monitor'],mixes:returnNames.filter(r => r.toLowerCase() === name.toLowerCase())};
}
function checkAdminPassword(given, cfg) { return !!cfg.adminPassword && typeof given === 'string' && equal(given,cfg.adminPassword); }
module.exports = {validMembers,normalizeAccess,sign,verify,identify,can,meFor,newMember,checkAdminPassword};
