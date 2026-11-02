import {matchReturn, routingSeen, sendNameFor, outputChannels, playerWarning} from './player-view.js';
export function createPlayerRenderer({refresh}) {
  const form = document.querySelector('.add-player'), message = form.querySelector('.add-player-status');
  const fields = form.elements;
  let edited = false, loaded = false, confirmed = false, known = null, matched = null, chosen = false;
  const existing = document.createElement('p'); existing.className = 'add-player-existing'; form.querySelector('.add-player-warning').before(existing);
  function matchExisting() {
    chosen = false; fields.channelId.value = '';
    try { matched = known ? matchReturn(known.returns,fields.sendName.value.trim()) : null; }
    catch (e) { matched = null; existing.textContent = e.message; return; }
    const ret = matched;
    existing.textContent = ret ? 'Existing return: ' + ret.name + ' · ' + (ret.type && ret.type.display_name || 'Unknown routing') + (ret.channel ? ' · ' + ret.channel.display_name : '') + '. Keep current output unless you choose another.' : '';

  }
  fields.name.oninput = () => { fields.sendName.value = sendNameFor(fields.name.value,fields.sendName.value,edited); confirmed = false; matchExisting(); };
  fields.sendName.oninput = () => { edited = true; confirmed = false; matchExisting(); };
  form.onchange = e => { confirmed = false; if (e.target === fields.channelId || e.target === fields.typeId) chosen = !!fields.channelId.value; };
  async function outputs() {
    try {
      const res = await fetch('/api/player-outputs'); if (!res.ok) throw Error(await res.text());
      const data = await res.json(); known = data;
      for (const [key, choices] of [['typeId',data.types],['channelId',outputChannels(data)]]) {
        fields[key].replaceChildren();
        const blank = document.createElement('option'); blank.value = ''; blank.textContent = key === 'channelId' ? 'Choose output' : 'Choose output type'; fields[key].append(blank);
        for (const choice of choices) { const option = document.createElement('option'); option.value = choice.identifier; option.textContent = key === 'channelId' ? choice.label : choice.display_name; option.disabled = !!choice.disabled; fields[key].append(option); }
        if (key === 'typeId' && choices.length === 1) fields[key].value = String(choices[0].identifier);
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
      if (!matched && (!chosen || !fields.channelId.value)) throw Error('Choose an explicit output before adding a new return');
      const res = await fetch('/api/players',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:fields.name.value.trim(),sendName:fields.sendName.value.trim(),typeId:fields.typeId.value,channelId:fields.channelId.value,confirmPlaying:confirmed,explicitOutput:chosen,reroute:!!matched && chosen,expectedRouting:routingSeen(matched)})});
      if (!res.ok) {
        const error = await res.text();
        if (res.status === 409 && (error.startsWith('Live is playing.') || error.startsWith('Live transport is unknown.'))) { confirmed = true; fields.add.textContent = 'Confirm Add while playing'; }
        else { confirmed = false; fields.add.textContent = 'Add player'; }
        throw Error(error);
      }
      const result = await res.json(); message.textContent = result.routeKept ? 'Linked existing return; its output was not changed. Mix: ' + result.returnName : 'Player saved. Mix: ' + result.returnName;
      confirmed = false; fields.add.textContent = 'Add player'; await refresh(); await outputs();
    } catch (e) { message.textContent = e.message; }
    finally { fields.add.disabled = !known || !known.types.length; }
  };
  return {render(show) { if (show && !loaded) { loaded = true; outputs(); } if (!show) loaded = false; }};
}
