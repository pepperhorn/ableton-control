'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const {parseSet} = require('./parse-set');
const {progress} = require('./progress');
const {parseMix} = require('./parse-mix');
const {authorize, isTrustedLoopback} = require('./auth');
const {loadConfig, saveConfig: persist, validConfig} = require('./config');
function createApp({bridge, config = loadConfig(), saveConfig = persist,
  webRoot = path.join(__dirname, '../web'), remoteAddressOf = req => req.socket.remoteAddress}) {
  let cfg = {...config}, parsed = parseSet([]), play = {playing:-1, fired:-1, playingSongId:null}, pos = null;
  let active, lastPos = 0, pendingPos, posTimer, closed = false, changing = false;
  let setJSON = null, mix = parseMix(), mixJSON = null;
  const sends = new Map(), levelUpdates = new Map();
  const clients = new Set(), servers = new Set(), sockets = new Set();
  const send = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  function broadcast(event, data) { for (const res of clients) { if (res.writableLength > 1024 * 256) res.destroy(); else send(res, event, data); } }
  function onScenes(raw) {
    const next = parseSet(raw), serialized = JSON.stringify(next);
    if (serialized === setJSON) return;
    parsed = next; setJSON = serialized;
    play = {...play, playingSongId:parsed.sceneToSong[play.playing] === undefined ? null : parsed.sceneToSong[play.playing]};
    broadcast('set', parsed); broadcast('play', play);
  }
  function onPlay(value) {
    play = {...value, playingSongId:parsed.sceneToSong[value.playing] === undefined ? null : parsed.sceneToSong[value.playing]};
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
  function setSend(value) {
    const key = `${value.trackIndex}:${value.returnIndex}`;
    let entry = sends.get(key);
    if (!entry) { entry = {last:0}; sends.set(key, entry); }
    entry.pending = value;
    const flush = () => {
      entry.timer = null;
      const pending = entry.pending; entry.pending = null;
      if (!pending || !target(pending)) return;
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
  function publicConfig() { return {port:cfg.port, username:cfg.username, hasPassword:!!cfg.password}; }
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
      const route = req.url.split('?')[0];
      if (route === '/api/events' && req.method === 'GET') {
        res.writeHead(200, {'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});
        clients.add(res); if (setJSON !== null) send(res, 'set', parsed);
        send(res, 'mix', mix);
        send(res, 'play', play); if (pos) send(res, 'pos', pos);
        res.on('close', () => clients.delete(res)); return;
      }
      if (route === '/api/fire' && req.method === 'POST') {
        let value; try { value = await body(req); } catch (_) { return reply(res, 400, 'Invalid JSON'); }
        if (!value || !Number.isInteger(value.sceneIndex) || typeof value.name !== 'string') return reply(res, 400, 'Invalid scene');
        const row = parsed.songs.flatMap(s => s.rows).find(r => r.sceneIndex === value.sceneIndex);
        if (!row || row.name !== value.name) return reply(res, 409, 'Set changed; tap again');
        bridge.fire(value.sceneIndex, value.name); return reply(res, 204);
      }
      if (route === '/api/send' && req.method === 'POST') {
        let value; try { value = await body(req); } catch (_) { return reply(res, 400, 'Invalid JSON'); }
        if (!value || !Number.isInteger(value.trackIndex) || !Number.isInteger(value.returnIndex) ||
            typeof value.rawName !== 'string' || typeof value.returnName !== 'string' ||
            typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value < 0 || value.value > 1)
          return reply(res, 400, 'Invalid send');
        if (!target(value)) return reply(res, 409, JSON.stringify({mix}), 'application/json');
        setSend(value); return reply(res, 204);
      }
      if (route === '/api/config') {
        if (!isTrustedLoopback(remoteAddress, req.headers.host)) return reply(res, 403, 'Settings are only available on the laptop.');
        if (req.method === 'GET') return json(res, publicConfig());
        if (req.method === 'POST') {
          let value; try { value = await body(req); } catch (_) { return reply(res, 400, 'Invalid JSON'); }
          if (!validConfig(value)) return reply(res, 400, 'Invalid port or credentials');
          if (value.password === '') value.password = cfg.password;
          if (changing) return reply(res, 409, 'Settings are being changed');
          changing = true;
          let candidate;
          try {
            if (value.port !== cfg.port) candidate = await start(value.port);
            await saveConfig(value);
            cfg = {port:value.port, username:value.username, password:value.password};
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
      if (closed) return; closed = true; clearInterval(ping); clearTimeout(posTimer);
      bridge.removeListener('mix', onMix); bridge.removeListener('level', onLevel);
      for (const entry of [...sends.values(), ...levelUpdates.values()]) clearTimeout(entry.timer);
      bridge.removeListener('scenes', onScenes); bridge.removeListener('play', onPlay); bridge.removeListener('pos', onPos);
      for (const res of clients) res.end(); for (const socket of sockets) socket.destroy();
      await Promise.all([...servers].map(s => new Promise(resolve => s.close(() => resolve()))));
    }
  };
}
module.exports = {createApp};
