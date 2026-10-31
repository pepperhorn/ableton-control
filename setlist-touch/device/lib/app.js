'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const {normalizeAccess, validMembers, sign, identify, can, meFor, newMember, checkAdminPassword} = require('./access');
const {parseSet} = require('./parse-set');
const {progress} = require('./progress');
const {parseMix} = require('./parse-mix');
const {parseTransport, validCommand} = require('./transport');
const {authorize, isTrustedLoopback} = require('./auth');
const {loadConfig, saveConfig: persist, validConfig} = require('./config');
function createApp({bridge, config = loadConfig(), saveConfig = persist,
  webRoot = path.join(__dirname, '../web'), remoteAddressOf = req => req.socket.remoteAddress}) {
  let cfg = normalizeAccess(config), parsed = parseSet([]), play = {playing:-1, fired:-1, playingSongId:null, current:null, next:null}, pos = null;
  let active, lastPos = 0, pendingPos, posTimer, closed = false, changing = false;
  const loginAttempts = new Map();
  let indexing = null, rawScenes = new Map();
  function sceneDetails(index) {
    // Live can publish new indexes before the rebuilt scene map arrives.
    if (indexing && indexing.done < indexing.total) return null;
    const scene = rawScenes.get(index);
    return scene ? {name:scene.name, color:scene.color, loopBeats:scene.loopBeats, beatsPerBar:scene.beatsPerBar} : null;
  }
  function refreshPlay() {
    play = {...play, playingSongId:parsed.sceneToSong[play.playing] === undefined ? null : parsed.sceneToSong[play.playing],
      current:sceneDetails(play.playing), next:sceneDetails(play.fired)};
  }
  function onProgress(value) {
    if (!value || !Number.isInteger(value.done) || !Number.isInteger(value.total) ||
        value.done < 0 || value.total < 0 || value.done > value.total) return;
    const previousPlay = JSON.stringify(play);
    indexing = {done:value.done, total:value.total};
    refreshPlay();
    broadcast('progress', indexing);
    // Invalidate on scan start and restore on completion, even without onPlay.
    if (JSON.stringify(play) !== previousPlay) broadcast('play', play);
  }
  bridge.on('progress', onProgress);
  let setJSON = null, mix = parseMix(), mixJSON = null;
  let transport = null, transportTimer = null, lastTransport = 0;
  function onTransport(raw) {
    const next = parseTransport(raw);
    if (!next) return;
    transport = next;
    const flush = () => { transportTimer = null; lastTransport = Date.now(); broadcast('transport', transport); };
    const delay = 100 - (Date.now() - lastTransport);
    if (delay <= 0) { clearTimeout(transportTimer); flush(); }
    else if (!transportTimer) transportTimer = setTimeout(flush, delay);
  }
  bridge.on('transport', onTransport);
  const sends = new Map(), levelUpdates = new Map();
  const clients = new Set(), servers = new Set(), sockets = new Set();
  const send = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  function broadcast(event, data) { for (const res of clients) { if (res.writableLength > 1024 * 256) res.destroy(); else send(res, event, data); } }
  function onScenes(raw) {
    const next = parseSet(raw), serialized = JSON.stringify(next);
    rawScenes = new Map(raw.map(scene => [scene.index, scene]));
    const previousPlay = JSON.stringify(play);
    const changed = serialized !== setJSON;
    parsed = next; setJSON = serialized; refreshPlay();
    if (changed) broadcast('set', parsed);
    if (changed || JSON.stringify(play) !== previousPlay) broadcast('play', play);
  }
  function onPlay(value) {
    play = {...value}; refreshPlay();
    if (!pos || pos.scene !== value.playing) { pos = null; pendingPos = null; }
    broadcast('play', play);
  }
  function flushPos() { posTimer = null; if (!pendingPos) return; pos = pendingPos; pendingPos = null; lastPos = Date.now(); broadcast('pos', pos); }
  function onPos(value) {
    const timing = progress(value);
    pendingPos = timing ? {scene:value.scene, ...timing} : {scene:value.scene, bar:null, bars:null, fraction:null};
    const delay = 50 - (Date.now() - lastPos);
    if (delay <= 0) flushPos(); else if (!posTimer) posTimer = setTimeout(flushPos, delay);
  }
  function target(value) {
    const strip = mix.strips.find(s => s.trackIndex === value.trackIndex);
    const ret = mix.returns.find(r => r.returnIndex === value.returnIndex);
    return strip && ret && strip.rawName === value.rawName && ret.name === value.returnName && strip.levels[value.returnIndex];
  }
  function onMix(raw) {
    const next = parseMix(raw), serialized = JSON.stringify(next);
    if (serialized === mixJSON) return;
    mix = next; mixJSON = serialized;
    // A delayed command must never outlive the target it was validated against.
    for (const [key, entry] of sends) if (entry.pending && !target(entry.pending)) {
      clearTimeout(entry.timer); sends.delete(key);
    }
    for (const entry of levelUpdates.values()) clearTimeout(entry.timer);
    levelUpdates.clear();
    broadcast('mix', mix);
  }
  function onLevel(level) {
    if (!level || !Number.isInteger(level.trackIndex) || !Number.isInteger(level.returnIndex) ||
        typeof level.value !== 'number' || !Number.isFinite(level.value) || level.value < 0 || level.value > 1) return;
    const strip = mix.strips.find(s => s.trackIndex === level.trackIndex);
    if (!strip || !strip.levels[level.returnIndex]) return;
    const value = {value:level.value, label:typeof level.label === 'string' ? level.label : ''};
    strip.levels[level.returnIndex] = value;
    mixJSON = JSON.stringify(mix);
    const key = `${level.trackIndex}:${level.returnIndex}`;
    let entry = levelUpdates.get(key);
    if (!entry) { entry = {last:0}; levelUpdates.set(key, entry); }
    entry.pending = {trackIndex:level.trackIndex, returnIndex:level.returnIndex, ...value};
    const flush = () => {
      clearTimeout(entry.timer); entry.timer = null;
      if (!entry.pending) return;
      entry.last = Date.now(); broadcast('level', entry.pending); entry.pending = null;
    };
    const delay = 33 - (Date.now() - entry.last);
    if (delay <= 0) flush(); else if (!entry.timer) entry.timer = setTimeout(flush, delay);
  }
  function setSend(value, identityOf) {
    const key = `${value.trackIndex}:${value.returnIndex}`;
    let entry = sends.get(key);
    if (!entry) { entry = {last:0}; sends.set(key, entry); }
    entry.pending = value; entry.identityOf = identityOf;
    const flush = () => {
      entry.timer = null;
      const pending = entry.pending; entry.pending = null;
      if (!pending || !target(pending) || !can(entry.identityOf(), 'send', pending.returnName)) return;
      entry.last = Date.now(); bridge.setSend(pending.trackIndex, pending.returnIndex, pending.value);
    };
    const delay = 33 - (Date.now() - entry.last);
    if (delay <= 0) flush(); else if (!entry.timer) entry.timer = setTimeout(flush, delay);
  }
  bridge.on('mix', onMix); bridge.on('level', onLevel);
  bridge.on('scenes', onScenes); bridge.on('play', onPlay); bridge.on('pos', onPos);
  const ping = setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 15000);
  ping.unref();
  function reply(res, status, body = '', type = 'text/plain; charset=utf-8') {
    res.writeHead(status, {'Content-Type':type, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'}); res.end(body);
  }
  function json(res, data) { reply(res, 200, JSON.stringify(data), 'application/json'); }
  function publicConfig() { return {port:cfg.port, username:cfg.username, hasPassword:!!cfg.password, ...(cfg.accessEnabled || cfg.adminPassword || cfg.members.length ? {hasAdminPassword:!!cfg.adminPassword,accessEnabled:cfg.accessEnabled} : {})}; }
  async function body(req) {
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new Error('Expected JSON');
    let text = '';
    for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 16384) throw new Error('Body too large'); }
    return JSON.parse(text);
  }
  async function handler(req, res) {
    try {
      const remoteAddress = remoteAddressOf(req);
      const access = authorize({remoteAddress, host:req.headers.host, authorization:req.headers.authorization}, cfg);
      if (access === 'challenge') { res.setHeader('WWW-Authenticate', 'Basic realm="Setlist Touch"'); return reply(res, 401, 'Authentication required'); }
      if (access === 'forbidden') return reply(res, 403, 'Set a password in Setlist Touch settings on the laptop.');
      if (req.method === 'POST' && req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return reply(res, 403, 'Invalid origin');
      const trusted = isTrustedLoopback(remoteAddress, req.headers.host);
      const identityOf = () => identify({trusted, cookie:req.headers.cookie},cfg);
      const identity = identityOf();
      const route = req.url.split('?')[0];
      const cookie = payload => res.setHeader('Set-Cookie', 'st_id=' + (payload ? sign(payload,cfg.secret) : '') + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + (payload ? 31536000 : 0));
      if (route === '/api/me' && req.method === 'GET') return json(res, meFor(identity,cfg));
      if (route === '/api/forget' && req.method === 'POST') { cookie(null); return reply(res,204); }
      if (route === '/api/identify' && req.method === 'POST') {
        let value; try { value = await body(req); } catch (_) { return reply(res,400,'Invalid JSON'); }
        const member = cfg.members.find(m => m.id === (value || {}).memberId);
        if (!member) return reply(res,404,'Unknown member');
        cookie({kind:'member',memberId:member.id}); return reply(res,204);
      }
      if (route === '/api/admin-login' && req.method === 'POST') {
        const now = Date.now();
        if (now - (loginAttempts.get(remoteAddress) || 0) < 1000) return reply(res,429,'Try again in a second');
        for (const [address,time] of loginAttempts) if (now - time >= 1000) loginAttempts.delete(address);
        loginAttempts.set(remoteAddress,now);
        let value; try { value = await body(req); } catch (_) { return reply(res,400,'Invalid JSON'); }
        if (!checkAdminPassword((value || {}).password,cfg)) return reply(res,403,'Incorrect admin password');
        cookie({kind:'admin'}); return reply(res,204);
      }
      if (route === '/api/members') {
        // Open access is not authority to administer the band from a phone.
        if (identity.kind !== 'admin') return reply(res,403,'Admin required');
        if (req.method === 'GET') return json(res,cfg.members.map(m => ({...m,orphanMixes:m.mixes.filter(name => !mix.returns.some(r => r.name === name))})));
        if (req.method === 'POST') {
          let value; try { value = await body(req); } catch (_) { return reply(res,400,'Invalid JSON'); }
          if (!value || !Array.isArray(value.members)) return reply(res,400,'Invalid members');
          if (value.members.some(m => !m || typeof m.name !== 'string')) return reply(res,400,'Invalid members');
          const members = value.members.map(m => {
            const defaults = !m.id ? newMember(m.name,mix.returns.map(r => r.name)) : {};
            return {id:m.id || defaults.id,name:m.name,pages:m.pages === undefined ? defaults.pages : m.pages,mixes:m.mixes === undefined ? defaults.mixes : m.mixes};
          });
          if (!validMembers(members)) return reply(res,400,'Invalid members');
          if (changing) return reply(res,409,'Settings are being changed');
          changing = true;
          try {
            const next = {...cfg,members,accessEnabled:cfg.accessEnabled || members.length > 0};
            await saveConfig(next); cfg = next; broadcast('access',null); return json(res,meFor(identityOf(),cfg));
          } finally { changing = false; }
        }
      }
      if (route === '/api/events' && req.method === 'GET') {
        res.writeHead(200, {'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});
        clients.add(res); if (setJSON !== null) send(res, 'set', parsed);
        send(res, 'mix', mix);
        if (transport) send(res, 'transport', transport);
        send(res, 'play', play); if (pos) send(res, 'pos', pos);
        if (indexing) send(res, 'progress', indexing);
        res.on('close', () => clients.delete(res)); return;
      }
      if (route === '/api/transport' && req.method === 'POST') {
        if (!can(identity,'transport')) return reply(res,403,'Transport not allowed');
        let value; try { value = await body(req); } catch (_) { return reply(res, 400, 'Invalid JSON'); }
        if (!validCommand(value)) return reply(res, 400, 'Invalid transport command');
        bridge.transport(value.command, value.value); return reply(res, 204);
      }
      if (route === '/api/fire' && req.method === 'POST') {
        if (!can(identity,'fire')) return reply(res,403,'Scenes not allowed');
        let value; try { value = await body(req); } catch (_) { return reply(res, 400, 'Invalid JSON'); }
        if (!value || !Number.isInteger(value.sceneIndex) || typeof value.name !== 'string') return reply(res, 400, 'Invalid scene');
        const row = parsed.songs.flatMap(s => s.rows).find(r => r.sceneIndex === value.sceneIndex);
        if (!row || row.name !== value.name) return reply(res, 409, 'Set changed; tap again');
        bridge.fire(value.sceneIndex, value.name); return reply(res, 204);
      }
      if (route === '/api/send' && req.method === 'POST') {
        let value; try { value = await body(req); } catch (_) { return reply(res, 400, 'Invalid JSON'); }
        const ret = value && mix.returns.find(r => r.returnIndex === value.returnIndex);
        if (!can(identity,'send',ret && ret.name)) return reply(res,403,'Mix not allowed');
        if (!value || !Number.isInteger(value.trackIndex) || !Number.isInteger(value.returnIndex) ||
            typeof value.rawName !== 'string' || typeof value.returnName !== 'string' ||
            typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value < 0 || value.value > 1)
          return reply(res, 400, 'Invalid send');
        if (!target(value)) return reply(res, 409, JSON.stringify({mix}), 'application/json');
        setSend(value, identityOf); return reply(res, 204);
      }
      if (route === '/api/config') {
        if (!isTrustedLoopback(remoteAddress, req.headers.host)) return reply(res, 403, 'Settings are only available on the laptop.');
        if (req.method === 'GET') return json(res, publicConfig());
        if (req.method === 'POST') {
          let value; try { value = await body(req); } catch (_) { return reply(res, 400, 'Invalid JSON'); }
          if (!validConfig(value)) return reply(res, 400, 'Invalid port or credentials');
          if (value.password === '') value.password = cfg.password;
          if (value.accessEnabled !== undefined && typeof value.accessEnabled !== 'boolean' || value.adminPassword !== undefined && typeof value.adminPassword !== 'string') return reply(res,400,'Invalid access settings');
          value = {...cfg, port:value.port,username:value.username,password:value.password,
            adminPassword:value.adminPassword || cfg.adminPassword, accessEnabled:value.accessEnabled === undefined ? cfg.accessEnabled : value.accessEnabled};
          if (changing) return reply(res, 409, 'Settings are being changed');
          changing = true;
          let candidate;
          try {
            if (value.port !== cfg.port) candidate = await start(value.port);
            await saveConfig(value);
            cfg = value; broadcast('access',null);
            const previous = active;
            if (candidate) { active = candidate; if (typeof bridge.addressChanged === 'function') bridge.addressChanged(cfg.port); }
            json(res, publicConfig());
            if (candidate && previous) {
              for (const client of clients) client.end();
              previous.close();
              // Existing keep-alive connections must not leave the old port serving.
              res.once('finish', () => { for (const socket of sockets) if (socket.server === previous) socket.end(); });
            }
          } catch (_) { if (candidate) candidate.close(); reply(res, 400, 'Could not save settings or bind port'); }
          finally { changing = false; }
          return;
        }
      }
      if (route.startsWith('/api/') || req.method !== 'GET') return reply(res, 404);
      let decoded; try { decoded = decodeURIComponent(route); } catch (_) { return reply(res, 404); }
      if (decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').includes('..')) return reply(res, 404);
      const root = await fs.promises.realpath(webRoot);
      const file = path.resolve(root, '.' + (decoded === '/' ? '/index.html' : decoded));
      if (!file.startsWith(root + path.sep)) return reply(res, 404);
      let actual; try { actual = await fs.promises.realpath(file); } catch (_) { return reply(res, 404); }
      if (!actual.startsWith(root + path.sep) || !(await fs.promises.stat(actual)).isFile()) return reply(res, 404);
      const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
      reply(res, 200, await fs.promises.readFile(actual), types[path.extname(actual)] || 'application/octet-stream');
    } catch (_) { if (!res.headersSent) reply(res, 500, 'Server error'); else res.destroy(); }
  }
  function start(port) {
    return new Promise((resolve, reject) => {
      const server = http.createServer(handler); servers.add(server);
      server.on('connection', socket => { socket.server = server; sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
      server.once('error', reject);
      server.listen(port, '0.0.0.0', () => { server.removeListener('error', reject); resolve(server); });
    });
  }
  return {
    async listen(port) { if (closed) throw new Error('App closed'); active = await start(port); return active.address().port; },
    getConfig() { return {...cfg}; },
    async close() {
      if (closed) return; closed = true; clearInterval(ping); clearTimeout(posTimer); clearTimeout(transportTimer);
      bridge.removeListener('transport', onTransport);
      bridge.removeListener('progress', onProgress);
      bridge.removeListener('mix', onMix); bridge.removeListener('level', onLevel);
      for (const entry of [...sends.values(), ...levelUpdates.values()]) clearTimeout(entry.timer);
      bridge.removeListener('scenes', onScenes); bridge.removeListener('play', onPlay); bridge.removeListener('pos', onPos);
      for (const res of clients) res.end(); for (const socket of sockets) socket.destroy();
      await Promise.all([...servers].map(s => new Promise(resolve => s.close(() => resolve()))));
    }
  };
}
module.exports = {createApp};
