'use strict';
function formatPosition(time, numerator = 4, denominator = 4) {
  if (!Number.isFinite(time) || !Number.isInteger(numerator) || numerator < 1 ||
      !Number.isInteger(denominator) || denominator < 1) return null;
  const beat = Math.floor(Math.max(0, time) * denominator / 4);
  return `${Math.floor(beat / numerator) + 1}.${beat % numerator + 1}`;
}
function validCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => key !== 'command' && key !== 'value')) return false;
  return value.command === 'record' ? value.value === 0 || value.value === 1 :
    (value.command === 'play' || value.command === 'stop') && value.value === undefined;
}
function parseTransport(raw) {
  if (!raw || ![0, 1].includes(raw.is_playing) || ![0, 1].includes(raw.record_mode) ||
      !Number.isFinite(raw.tempo) || raw.tempo <= 0 ||
      !Number.isInteger(raw.signature_numerator) || !Number.isInteger(raw.signature_denominator)) return null;
  const position = formatPosition(raw.current_song_time, raw.signature_numerator, raw.signature_denominator);
  if (position === null) return null;
  return {is_playing:raw.is_playing, record_mode:raw.record_mode, tempo:raw.tempo,
    current_song_time:raw.current_song_time, signature_numerator:raw.signature_numerator,
    signature_denominator:raw.signature_denominator, position};
}
module.exports = {formatPosition, validCommand, parseTransport};
