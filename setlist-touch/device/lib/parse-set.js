'use strict';
function parseSet(scenes) {
  const result = { categories: [], songs: [], sceneToSong: {} };
  const occurrences = new Map();
  let category = null, song = null;
  function close() {
    if (!song) return;
    let end = song.rows.length;
    while (end > 0 && song.rows[end - 1].isEnd) end--;
    song.rows.splice(end + 1);
    for (const row of song.rows) result.sceneToSong[row.sceneIndex] = song.id;
    song = null;
  }
  for (const scene of scenes) {
    const heading = /^\*\s*\[\[\s*(.*?)\s*\]\]\s*$/.exec(scene.name);
    if (heading) {
      close(); category = heading[1];
      if (!result.categories.includes(category)) result.categories.push(category);
    } else if (/^\*\s/.test(scene.name)) {
      close();
      const title = scene.name.replace(/^\*\s/, '');
      const occurrence = (occurrences.get(title) || 0) + 1;
      occurrences.set(title, occurrence);
      song = { id: scene.index, title, occurrence, category, rows: [] };
      result.songs.push(song);
    } else if (song) {
      song.rows.push({ sceneIndex: scene.index, name: scene.name, color: scene.color,
        loopBeats: scene.loopBeats, beatsPerBar: scene.beatsPerBar, isEnd: scene.name.trim() === '' });
    }
  }
  close(); return result;
}
module.exports = { parseSet };
