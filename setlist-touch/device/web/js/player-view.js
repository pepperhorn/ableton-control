function sameChannel(a, b) {
  if (!a || !b) return false;
  const hasId = value => value.identifier !== undefined && value.identifier !== null;
  return hasId(a) && hasId(b) && String(a.identifier) === String(b.identifier) ||
    typeof a.display_name === 'string' && a.display_name.trim() !== '' &&
    typeof b.display_name === 'string' && a.display_name.trim() === b.display_name.trim();
}
export function sendNameFor(player, send, edited) { return edited ? send : player; }
export function outputLabel(channel, returns, main = null) {
  const users = [...returns,...(main ? [main] : [])].filter(r => sameChannel(r.channel,channel)).map(r => r.name);
  return channel.display_name + (users.length ? ' · ' + users.join(', ') : '');
}
export function playerWarning(outputs) {
  const noChannels = 'Live did not provide external output channels. Route one return to Ext. Out in Live, then refresh outputs before adding a new player.';
  if (!outputs.types.length) return 'No external outputs available. Enable outputs in Live’s audio preferences.' + (!outputs.channels.length ? ' ' + noChannels : '');
  if (!outputs.channels.length) return noChannels;
  if (outputs.returns.length >= 12) return 'Live allows 12 returns. You can still link an existing player return.';
  return '';
}

export function matchReturn(returns, name) {
  const normalized = value => value.trim().replace(/^[A-L][- ]/, '');
  const exact = returns.filter(r => r.name.trim() === name.trim());
  const matches = exact.length ? exact : returns.filter(r => normalized(r.name) === name.trim());
  if (matches.length > 1) throw Error('More than one return has that name');
  return matches[0] || null;
}
export function routingSeen(ret) {
  return ret ? {index:ret.index,name:ret.name,typeId:(ret.type || {}).identifier,channelId:(ret.channel || {}).identifier} : null;
}

export function outputChannels(outputs) {
  const channels = outputs.channels.map(c => ({...c,label:outputLabel(c,outputs.returns,outputs.main)}));
  const main = outputs.main && outputs.main.channel;
  if (main && typeof main.display_name === 'string' && !channels.some(c => sameChannel(c,main)))
    channels.push({identifier:'',label:'Main: ' + main.display_name + ' (current output; unavailable for returns)',disabled:true});
  return channels;
}
