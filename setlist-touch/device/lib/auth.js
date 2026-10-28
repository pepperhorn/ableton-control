'use strict';
const {timingSafeEqual} = require('crypto');
const {isIP} = require('net');
function isLoopback(address) {
  if (address === '::1') return true;
  const ip = (address || '').replace(/^::ffff:/i, '');
  return isIP(ip) === 4 && ip.startsWith('127.');
}
function checkBasic(header, config) {
  if (!config.password || typeof header !== 'string' || !/^Basic [A-Za-z0-9+/]+={0,2}$/i.test(header)) return false;
  const given = Buffer.from(header.slice(6), 'base64');
  const expected = Buffer.from(config.username + ':' + config.password);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
function authorize({remoteAddress, authorization}, config) {
  if (isLoopback(remoteAddress)) return 'ok';
  if (!config.password) return 'forbidden';
  return checkBasic(authorization, config) ? 'ok' : 'challenge';
}
module.exports = {isLoopback, checkBasic, authorize};
