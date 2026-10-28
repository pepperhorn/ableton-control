import {currentSong, visibleSongs, banner} from './view-state.js';
import {fitRows} from './layout.js';
const $ = selector => document.querySelector(selector);
function el(tag, className, text) {
  const node = document.createElement(tag); node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function render(state, set, play, pos, local) {
  const song = currentSong(state, set), visible = visibleSongs(state, set);
  document.body.classList.toggle('locked', state.locked);
  $('.connection-bar').hidden = state.connected;
  $('.sidebar-toggle').textContent = state.sidebarOpen ? '◀◀ Hide' : '☰ Setlist';
  $('.sidebar-toggle').setAttribute('aria-expanded', String(state.sidebarOpen));
  $('.setlist-sidebar').hidden = !state.sidebarOpen;
  $('.song-title').textContent = song ? song.title : 'Setlist Touch';
  $('.lock-toggle').textContent = state.locked ? '🔒 Locked' : 'Lock';
  $('.lock-toggle').setAttribute('aria-pressed', String(state.locked));
  $('.settings-link').hidden = !local;
  const index = visible.findIndex(s => song && s.id === song.id);
  for (const [dir, selector] of [[-1,'.song-nav-prev'],[1,'.song-nav-next']]) {
    const neighbour = index < 0 ? (dir > 0 ? visible[0] : visible[visible.length - 1]) : visible[index + dir];
    const node = $(selector); node.disabled = !neighbour;
    node.textContent = dir < 0 ? '◀ ' + (neighbour ? neighbour.title : 'Previous') : (neighbour ? neighbour.title : 'Next') + ' ▶';
    node.title = node.textContent;
  }
  const pills = $('.filter-pills'); pills.replaceChildren();
  for (const category of [null, ...set.categories]) {
    const pill = el('button', 'filter-pill' + (state.filter === category ? ' is-active' : ''), category === null ? 'All' : category);
    pill.type = 'button'; pill.dataset.category = category === null ? '' : category;
    pill.setAttribute('aria-pressed', String(state.filter === category));
    pill.addEventListener('click', () => pills.dispatchEvent(new CustomEvent('chooseFilter', {bubbles:true, detail:category})));
    pills.append(pill);
  }
  const songs = $('.setlist-songs'); songs.replaceChildren(); let lastCategory;
  for (const item of visible) {
    if (item.category !== lastCategory && item.category !== null) songs.append(el('h2','category-heading',item.category));
    lastCategory = item.category;
    const button = el('button','setlist-item' + (song && song.id === item.id ? ' is-current' : ''),item.title);
    button.type = 'button'; button.dataset.songId = item.id;
    if (song && song.id === item.id) button.setAttribute('aria-current','true');
    songs.append(button);
  }
  const rows = $('.scene-list'); rows.replaceChildren();
  if (!song || !song.rows.length) rows.append(el('p','scene-empty',song ? 'No sections in this song' : 'Waiting for songs from Live…'));
  for (const row of song ? song.rows : []) {
    const button = el('button', 'scene-row' + (row.isEnd ? ' scene-row-end' : ''));
    button.type = 'button'; button.dataset.sceneIndex = row.sceneIndex; button.dataset.name = row.name;
    button.style.backgroundColor = row.isEnd ? '#9A9A9A' : '#' + (row.color >>> 0).toString(16).padStart(6,'0').slice(-6);
    const lines = el('span','tile-barlines'); lines.setAttribute('aria-hidden','true');
    if (Number.isFinite(row.loopBeats) && row.loopBeats > 0 && row.beatsPerBar > 0) {
      // Avoid freezing the surface on pathological clips with millions of bars.
      const bars = row.loopBeats / row.beatsPerBar;
      const stride = Math.max(1, Math.ceil(bars / 2048));
      for (let k = stride; k < bars; k += stride) {
        const line = el('i','tile-barline' + (k % 4 === 0 ? ' bar-4' : ''));
        line.style.left = (k / bars * 100) + '%'; lines.append(line);
      }
    }
    const progress = el('span','tile-progress'); progress.hidden = true;
    const counter = el('span','tile-bars'); counter.hidden = true;
    button.append(lines, progress, el('span','scene-label',row.isEnd ? '■ End' : row.name),counter);
    rows.append(button);
  }
  updatePlayback(state, set, play, pos);
  fitSceneRows();
}
export function fitSceneRows() {
  const rows = $('.scene-list');
  const {rowHeight, scroll} = fitRows(rows.querySelectorAll('.scene-row').length, Math.max(0, rows.clientHeight - 8));
  rows.style.setProperty('--row-height', rowHeight + 'px'); rows.classList.toggle('is-scrollable', scroll);
}
export function updatePlayback(state, set, play, pos) {
  const song = currentSong(state, set);
  for (const button of document.querySelectorAll('.scene-row')) {
    const index = Number(button.dataset.sceneIndex), row = song && song.rows.find(r => r.sceneIndex === index);
    button.classList.toggle('is-playing', index === play.playing);
    button.classList.toggle('is-queued', index === play.fired);
    const hasProgress = index === play.playing && pos && pos.scene === index && pos.fraction !== null && row && row.loopBeats > 0;
    const fill = button.querySelector('.tile-progress'), counter = button.querySelector('.tile-bars');
    fill.hidden = !hasProgress; counter.hidden = !hasProgress;
    if (hasProgress) { fill.style.width = (pos.fraction * 100) + '%'; counter.textContent = `${pos.bar} / ${Math.ceil(pos.bars)}`; }
  }
  const now = banner(state, set, play), node = $('.now-playing-banner');
  node.hidden = !now; node.textContent = now ? 'Now playing: ' + now.title : '';
  fitSceneRows();
}
