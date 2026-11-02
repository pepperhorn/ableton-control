import {sendNameFor, outputLabel, playerWarning} from './player-view.js';
export function createPlayerRenderer({refresh}) {
  const form = document.querySelector('.add-player'), message = form.querySelector('.add-player-status');
  const fields = form.elements;
  let edited = false, loaded = false, confirmed = false, known = null;
  const existing = document.createElement('p'); existing.className = 'add-player-existing'; form.querySelector('.add-player-warning').before(existing);
  function matchExisting() {
    const ret = known && known.returns.find(r => r.name === fields.sendName.value);
    existing.textContent = ret ? 'Existing return: ' + (ret.type && ret.type.display_name || 'Unknown routing') + (ret.channel ? ' · ' + ret.channel.display_name : '') : '';
    if (ret) for (const [key,value] of [['typeId',ret.type],['channelId',ret.channel]]) if (value && [...fields[key].options].some(o => o.value === String(value.identifier))) fields[key].value = String(value.identifier);
  }
  fields.name.oninput = () => { fields.sendName.value = sendNameFor(fields.name.value,fields.sendName.value,edited); confirmed = false; matchExisting(); };
  fields.sendName.oninput = () => { edited = true; confirmed = false; matchExisting(); };
  form.onchange = () => { confirmed = false; };
  async function outputs() {
    try {
      const res = await fetch('/api/player-outputs'); if (!res.ok) throw Error(await res.text());
      const data = await res.json(); known = data;
      for (const [key, choices] of [['typeId',data.types],['channelId',data.channels]]) {
        const previous = fields[key].value; fields[key].replaceChildren();
        for (const choice of choices) { const option = document.createElement('option'); option.value = choice.identifier; option.textContent = key === 'channelId' ? outputLabel(choice,data.returns) : choice.display_name; fields[key].append(option); }
        if (choices.some(c => String(c.identifier) === previous)) fields[key].value = previous;
      }
      form.querySelector('.add-player-warning').textContent = playerWarning(data);
      fields.add.disabled = !data.types.length;
      loaded = true; matchExisting();
    } catch (e) { message.textContent = e.message; }
  }
  form.querySelector('.add-player-refresh').onclick = outputs;
  form.onsubmit = async event => {
    event.preventDefault(); fields.add.disabled = true;
    try {
      const res = await fetch('/api/players',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:fields.name.value.trim(),sendName:fields.sendName.value.trim(),typeId:fields.typeId.value,channelId:fields.channelId.value,confirmPlaying:confirmed})});
      if (!res.ok) {
        const error = await res.text();
        if (res.status === 409 && error.startsWith('Live is playing.')) { confirmed = true; fields.add.textContent = 'Confirm Add while playing'; }
        else { confirmed = false; fields.add.textContent = 'Add player'; }
        throw Error(error);
      }
      const result = await res.json(); message.textContent = 'Player saved. Mix: ' + result.returnName;
      confirmed = false; fields.add.textContent = 'Add player'; await refresh(); await outputs();
    } catch (e) { message.textContent = e.message; }
    finally { fields.add.disabled = !fields.typeId.options.length; }
  };
  return {render(show) { if (show && !loaded) { loaded = true; outputs(); } if (!show) loaded = false; }};
}
