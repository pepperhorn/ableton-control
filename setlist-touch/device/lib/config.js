'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const {normalizeAccess, validMembers} = require('./access');
const DEFAULT_CONFIG = Object.freeze({port:8765, username:'band', password:''});
function configPath() { return path.join(os.homedir(), 'Documents', 'SetlistTouch', 'config.json'); }
function validConfig(cfg) {
  return cfg && Number.isInteger(cfg.port) && cfg.port > 0 && cfg.port <= 65535 &&
    typeof cfg.username === 'string' && cfg.username.length > 0 && !/[:\r\n]/.test(cfg.username) && typeof cfg.password === 'string';
}
function loadConfig(file = configPath()) {
  let raw, original, damaged = false, missing = false;
  try {
    original = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!original || typeof original !== 'object' || Array.isArray(original)) throw new Error('Invalid config');
    raw = {...DEFAULT_CONFIG, ...original};
    if (!validConfig(raw)) throw new Error('Invalid base config');
  } catch (error) {
    missing = error.code === 'ENOENT'; damaged = !missing;
    raw = {...DEFAULT_CONFIG};
  }
  const cfg = normalizeAccess(damaged ? {...raw,accessEnabled:true,members:[]} : raw);
  const accessValid = raw.accessEnabled === undefined && raw.members === undefined ||
    typeof raw.accessEnabled === 'boolean' && validMembers(raw.members);
  if (!damaged && accessValid && cfg.secret !== raw.secret) {
    // Never replace damaged user data with normalized defaults on startup.
    // Persistence failure must not prevent the laptop from starting.
    try { writeConfig({...(missing ? raw : original), secret:cfg.secret}, file); } catch (_) {}
  }
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
  writeConfig(value, file);
}
function writeConfig(value, file) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n', {mode:0o600});
  fs.renameSync(file + '.tmp', file);
}
module.exports = {DEFAULT_CONFIG, configPath, loadConfig, saveConfig, validConfig};
