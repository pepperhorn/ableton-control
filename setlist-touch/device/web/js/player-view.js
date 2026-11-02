export function sendNameFor(player, send, edited) { return edited ? send : player; }
export function outputLabel(channel, returns, main = null) {
  const users = [...returns,...(main ? [main] : [])].filter(r => r.channel && String(r.channel.identifier) === String(channel.identifier)).map(r => r.name);
  return channel.display_name + (users.length ? ' · ' + users.join(', ') : '');
}
export function playerWarning(outputs) {
  if (!outputs.types.length) return 'No external outputs available. Enable outputs in Live’s audio preferences.';
  if (!outputs.channels.length) return 'No output channels are readable. Configure an external return in Live, then refresh outputs before adding a new player.';
  if (outputs.returns.length >= 12) return 'Live allows 12 returns. You can still link an existing player return.';
  return '';
}

export function matchReturn(returns, name) {
  const normalized = value => value.trim().replace(/^[A-L][- ]/, '');
  const exact = returns.filter(r => r.name.trim() === name.trim());
  const matches = exact.length ? exact : returns.filter(r => normalized(r.name) === normalized(name));
  if (matches.length > 1) throw Error('More than one return has that name');
  return matches[0] || null;
}
export function routingSeen(ret) {
  return ret ? {index:ret.index,name:ret.name,typeId:(ret.type || {}).identifier,channelId:(ret.channel || {}).identifier} : null;
}

export function outputChannels(outputs) {
  const channels = outputs.channels.map(c => ({...c,label:outputLabel(c,outputs.returns,outputs.main)}));
  const main = outputs.main && outputs.main.channel;
  if (main && typeof main.display_name === 'string' && !channels.some(c => String(c.identifier) === String(main.identifier)))
    channels.push({identifier:'',label:'Main: ' + main.display_name + ' (current output; unavailable for returns)',disabled:true});
  return channels;
}
