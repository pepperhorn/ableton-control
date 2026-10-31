'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const {normalizeAccess} = require('./access');
const DEFAULT_CONFIG = Object.freeze({port:8765, username:'band', password:''});
function configPath() { return path.join(os.homedir(), 'Documents', 'SetlistTouch', 'config.json'); }
function validConfig(cfg) {
  return cfg && Number.isInteger(cfg.port) && cfg.port > 0 && cfg.port <= 65535 &&
    typeof cfg.username === 'string' && cfg.username.length > 0 && !/[:\r\n]/.test(cfg.username) && typeof cfg.password === 'string';
}
function loadConfig(file = configPath()) {
  let raw;
  try { raw = {...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(file, 'utf8'))}; }
  catch (_) { raw = {...DEFAULT_CONFIG}; }
  if (!validConfig(raw)) raw = {...DEFAULT_CONFIG};
  const cfg = normalizeAccess(raw);
  if (cfg.secret !== raw.secret) saveConfig(cfg, file);
  // Preserve the enumerable shape of legacy configs for existing consumers.
  // Access fields remain readable and are persisted through toJSON on save.
  if (raw.accessEnabled === undefined && raw.members === undefined) {
    const legacy = {...raw};
    for (const key of ['accessEnabled','members','adminPassword','secret']) Object.defineProperty(legacy,key,{value:cfg[key],enumerable:false,writable:true});
    Object.defineProperty(legacy,'toJSON',{value:() => ({...legacy,accessEnabled:legacy.accessEnabled,members:legacy.members,adminPassword:legacy.adminPassword,secret:legacy.secret}),enumerable:false});
    return legacy;
  }
  return cfg;
}
function saveConfig(cfg, file = configPath()) {
  const value = {...DEFAULT_CONFIG, ...(typeof cfg.toJSON === 'function' ? cfg.toJSON() : cfg)};
  if (!validConfig(value)) throw new Error('Invalid configuration');
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n', {mode:0o600});
  fs.renameSync(file + '.tmp', file);
}
module.exports = {DEFAULT_CONFIG, configPath, loadConfig, saveConfig, validConfig};
