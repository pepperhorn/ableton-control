const count = value => Number.isInteger(value) && value >= 0 && value <= 8 ? value : 2;
export function sceneWindow({songs = [], play = {}, pos, before = 2, after = 2}) {
  if (!play.current || !(play.playing >= 0)) return null;
  const song = songs.find(s => s.id === play.playingSongId);
  const at = song && song.rows.findIndex(r => r.sceneIndex === play.playing);
  if (at == null || at < 0) return null;
  return {currentIndex:play.playing, rows:song.rows.slice(Math.max(0, at-count(before)),at+count(after)+1).map(row => {
    const current = row.sceneIndex === play.playing;
    const bars = row.loopBeats > 0 && row.beatsPerBar > 0 ? row.loopBeats / row.beatsPerBar : null;
    const progress = current && bars && pos && pos.scene === row.sceneIndex &&
      Number.isFinite(pos.bar) && Number.isFinite(pos.bars) && Number.isFinite(pos.fraction) ?
      {bar:pos.bar,bars:pos.bars,fraction:Math.max(0,Math.min(1,pos.fraction))} : null;
    return {index:row.sceneIndex,name:row.name,color:row.color,bars,
      role:current?'current':row.sceneIndex < play.playing?'before':'after',progress};
  })};
}
export function readSceneBar(storage) { try { return storage.getItem('st.sceneBar') !== '0'; } catch (_) { return true; } }
export function saveSceneBar(storage, shown) { try { storage.setItem('st.sceneBar',shown?'1':'0'); } catch (_) {} }
