// Position already contains lib/progress.js's calculation, shared with Scenes.
export function monitorView({songs = [], play = {}, pos, transport, connected}) {
  if (!connected) return {status:'Disconnected', song:'', current:null, next:null, progress:null};
  const running = transport ? !!transport.is_playing : play.playing >= 0;
  const current = running && play.playing >= 0 ? play.current || null : null;
  const next = play.fired >= 0 ? play.next || null : null;
  const progress = current && current.loopBeats > 0 && pos && pos.scene === play.playing &&
    Number.isFinite(pos.fraction) && Number.isFinite(pos.bar) && Number.isFinite(pos.bars) ? pos : null;
  return {status:current ? null : running ? 'Playing' : 'Stopped',
    song:current && play.playingSongId != null ? (songs.find(s => s.id === play.playingSongId) || {}).title || '' : '',
    current:current && {...current, name:current.name.replace(/^\* /, '')},
    next:next && {...next, name:next.name.replace(/^\* /, '')}, progress};
}
