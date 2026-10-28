'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const DEFAULT_CONFIG = Object.freeze({port:8765, username:'band', password:''});
function configPath() { return path.join(os.homedir(), 'Documents', 'SetlistTouch', 'config.json'); }
function validConfig(cfg) {
  return cfg && Number.isInteger(cfg.port) && cfg.port > 0 && cfg.port <= 65535 &&
    typeof cfg.username === 'string' && cfg.username.length > 0 && !/[:\r\n]/.test(cfg.username) && typeof cfg.password === 'string';
}
function loadConfig(file = configPath()) {
  try { const cfg = {...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(file, 'utf8'))}; return validConfig(cfg) ? cfg : {...DEFAULT_CONFIG}; }
  catch (_) { return {...DEFAULT_CONFIG}; }
}
function saveConfig(cfg, file = configPath()) {
  const value = {...DEFAULT_CONFIG, ...cfg};
  if (!validConfig(value)) throw new Error('Invalid configuration');
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n', {mode:0o600});
  fs.renameSync(file + '.tmp', file);
}
module.exports = {DEFAULT_CONFIG, configPath, loadConfig, saveConfig, validConfig};
