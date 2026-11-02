export function sendNameFor(player, send, edited) { return edited ? send : player; }
export function outputLabel(channel, returns) {
  const users = returns.filter(r => r.channel && String(r.channel.identifier) === String(channel.identifier)).map(r => r.name);
  return channel.display_name + (users.length ? ' · ' + users.join(', ') : '');
}
export function playerWarning(outputs) {
  if (!outputs.types.length) return 'No external outputs available. Enable outputs in Live’s audio preferences.';
  if (!outputs.channels.length) return 'Channels are not available yet. Add creates the return first; refresh outputs to choose its channel, or set it in Live.';
  if (outputs.returns.length >= 12) return 'Live allows 12 returns. You can still link an existing player return.';
  return '';
}
