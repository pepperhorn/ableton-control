const keyOf = song => song ? {title:song.title, occurrence:song.occurrence} : null;
const same = (song, key) => song && key && song.title === key.title && song.occurrence === key.occurrence;
export function initialState(prefs = {}) {
  return {songKey:null, filter:typeof prefs.filter === 'string' ? prefs.filter : null,
    sidebarOpen:prefs.sidebarOpen !== false, locked:prefs.locked === true, connected:false, songOrder:[]};
}
export function currentSong(state, set) { return set.songs.find(song => same(song, state.songKey)) || null; }
export function visibleSongs(state, set) { return set.songs.filter(song => state.filter === null || song.category === state.filter); }
export function canLaunch(state) { return !state.locked && state.connected; }
export function prefsOf({sidebarOpen, locked, filter}, mixPrefs) { return {sidebarOpen, locked, filter, ...mixPrefs}; }
export function banner(state, set, play) {
  const song = set.songs.find(s => s.id === play.playingSongId);
  return song && !same(song, state.songKey) ? {songId:song.id, title:song.title} : null;
}
export function reduce(state, action, set) {
  function select(song) { return {...state, songKey:keyOf(song), songOrder:set.songs.map(keyOf)}; }
  switch (action.type) {
    case 'set': {
      if (!set.songs.length) return state;
      let song = currentSong(state, set);
      if (!song && !state.songKey) song = set.songs.find(s => s.id === (action.play || {}).playingSongId) || set.songs[0];
      if (!song && state.songKey) {
        const order = state.songOrder || [], index = order.findIndex(k => same(k, state.songKey));
        const following = order.slice(index + 1), preceding = order.slice(0, Math.max(0, index)).reverse();
        for (const key of [...following, ...preceding]) { song = set.songs.find(s => same(s, key)); if (song) break; }
        if (!song) song = set.songs[0];
      }
      const next = select(song);
      if (next.filter !== null && !set.categories.includes(next.filter)) next.filter = null;
      return next;
    }
    case 'selectSong': return select(set.songs.find(s => s.id === action.id) || currentSong(state, set));
    case 'stepSong': {
      const songs = visibleSongs(state, set), index = songs.findIndex(s => same(s, state.songKey));
      const next = index < 0 ? (action.dir > 0 ? 0 : songs.length - 1) : Math.max(0, Math.min(songs.length - 1, index + action.dir));
      return songs.length ? select(songs[next]) : state;
    }
    case 'showPlaying': {
      const song = set.songs.find(s => s.id === action.play.playingSongId);
      return song ? select(song) : state;
    }
    case 'filter': return {...state, filter:action.category};
    case 'toggleSidebar': return {...state, sidebarOpen:!state.sidebarOpen};
    case 'toggleLock': return {...state, locked:!state.locked};
    case 'connected': return {...state, connected:!!action.value};
    default: return state;
  }
}
