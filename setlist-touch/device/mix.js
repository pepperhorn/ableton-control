// Classic Max js: ES5, observer-driven, no polling. Writes arrive via deferlow.
autowatch = 1;
inlets = 1;
outlets = 1;
var root = null, mixDict = null, debounce = null, levelTask = null;
var rootObservers = [], metadataObservers = [], sendObservers = [];
var active = false, building = false, dirty = true, generation = 0, levelsPending = false;
var snapshot = {returns:[], tracks:[]}, trackIds = '', returnIds = '', pendingLevels = {};

function scalar(api, property) {
    var value = api.get(property);
    return Array.isArray(value) ? value[0] : value;
}
function text(api, property) {
    var value = api.get(property);
    return Array.isArray(value) ? value.join(' ') : String(value);
}
function release(api) {
    if (!api) return;
    try { api.property = ''; api.id = 0; } catch (e) {}
}
function releaseAll(list) {
    for (var i = 0; i < list.length; i++) release(list[i]);
    list.length = 0;
}
function watch(path, property, callback, list) {
    var api = new LiveAPI(callback, path);
    list.push(api);
    api.property = property;
    return api;
}
// Unknown routing is excluded by parse-mix; never assume an unreadable route is external.
function routedToMain(api) {
    try {
        var raw = api.get('output_routing_type');
        if (Array.isArray(raw)) raw = raw.join(' ');
        var routing = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!routing || typeof routing.display_name !== 'string' || !routing.display_name.length) return null;
        return /^(main|master)$/i.test(routing.display_name);
    } catch (e) { return null; }
}
function labelFor(api, value) {
    try {
        var label = api.call('str_for_value', value);
        return Array.isArray(label) ? label.join(' ') : String(label || '');
    } catch (e) { return ''; } // UI marks a computed fallback as approximate.
}
function readLevel(api) {
    var value = Number(scalar(api, 'value'));
    if (!isFinite(value) || value < 0 || value > 1) return null;
    return {value:value, label:labelFor(api, value)};
}
function schedule() {
    if (!active || building) return;
    dirty = true;
    debounce.cancel(); debounce.schedule(200);
}
function refresh() {
    notifydeleted(); active = true;
    root = new LiveAPI('live_set'); mixDict = new Dict('setlist_touch_mix');
    debounce = new Task(rebuild, this); levelTask = new Task(flushLevels, this);
    building = true;
    watch('live_set', 'tracks', schedule, rootObservers);
    watch('live_set', 'return_tracks', schedule, rootObservers);
    building = false; rebuild();
}
function valueChanged(trackIndex, returnIndex, api, version) {
    if (!active || building || dirty || version !== generation || !api || !api.id) return;
    pendingLevels[trackIndex + ':' + returnIndex] = {trackIndex:trackIndex, returnIndex:returnIndex, api:api};
    // One scheduled batch, regardless of how many knobs change within this window.
    if (!levelsPending) { levelsPending = true; levelTask.schedule(33); }
}
function observeSend(path, trackIndex, returnIndex) {
    var version = generation, api;
    api = watch(path, 'value', function () { valueChanged(trackIndex, returnIndex, api, version); }, sendObservers);
    return api;
}
function flushLevels() {
    levelsPending = false;
    var pending = pendingLevels; pendingLevels = {};
    if (!active || building || dirty) return;
    for (var key in pending) if (pending.hasOwnProperty(key)) {
        var entry = pending[key];
        try {
            var level = readLevel(entry.api);
            if (!level) continue;
            for (var i = 0; i < snapshot.tracks.length; i++) if (snapshot.tracks[i].index === entry.trackIndex)
                snapshot.tracks[i].sends[entry.returnIndex] = level;
            outlet(0, 'level', entry.trackIndex, entry.returnIndex, level.value, level.label);
        } catch (e) { schedule(); }
    }
}
function rebuild() {
    if (!active || building) return;
    building = true; generation++;
    levelTask.cancel(); levelsPending = false; pendingLevels = {};
    releaseAll(metadataObservers); releaseAll(sendObservers);
    var next = {returns:[], tracks:[]};
    try {
        trackIds = String(root.get('tracks')); returnIds = String(root.get('return_tracks'));
        var trackCount = root.getcount('tracks'), returnCount = root.getcount('return_tracks');
        var i, j, path, api, item, param;
        for (j = 0; j < returnCount; j++) {
            path = 'live_set return_tracks ' + j; api = new LiveAPI(path);
            item = {index:j, name:text(api, 'name'), color:Number(scalar(api, 'color')), routedToMain:routedToMain(api)};
            next.returns.push(item); release(api);
            watch(path, 'name', schedule, metadataObservers);
            watch(path, 'color', schedule, metadataObservers);
            watch(path, 'output_routing_type', schedule, metadataObservers);
        }
        for (i = 0; i < trackCount; i++) {
            path = 'live_set tracks ' + i; api = new LiveAPI(path);
            item = {index:i, name:text(api, 'name'), color:Number(scalar(api, 'color')), sends:[]};
            release(api);
            // Untagged tracks must also be observed so adding '+ ' opts them in.
            watch(path, 'name', schedule, metadataObservers);
            watch(path, 'color', schedule, metadataObservers);
            if (item.name.indexOf('+ ') !== 0) continue;
            for (j = 0; j < returnCount; j++) if (next.returns[j].routedToMain === false) {
                param = null;
                try {
                    param = observeSend(path + ' mixer_device sends ' + j, i, j);
                    item.sends[j] = readLevel(param);
                } catch (e) { release(param); item.sends[j] = null; }
            }
            next.tracks.push(item);
        }
        snapshot = next; dirty = false;
        mixDict.set('mix', JSON.stringify(snapshot)); outlet(0, 'mix');
    } catch (e) {
        dirty = true;
        // Drop stale controls if Live is temporarily unavailable.
        snapshot = {returns:[], tracks:[]};
        mixDict.set('mix', JSON.stringify(snapshot)); outlet(0, 'mix');
        post('Setlist Touch mix refresh: ' + e + '\n');
    }
    building = false;
}
function send(trackIndex, returnIndex, value, expectedTrackName, expectedReturnName) {
    if (!active || dirty || building || !root) return;
    trackIndex = Number(trackIndex); returnIndex = Number(returnIndex); value = Number(value);
    if (!isFinite(value) || value < 0 || value > 1 || trackIndex < 0 || returnIndex < 0 ||
        trackIndex !== Math.floor(trackIndex) || returnIndex !== Math.floor(returnIndex)) return;
    var track = null, ret = snapshot.returns[returnIndex], i, api = null, returnApi = null, param = null;
    for (i = 0; i < snapshot.tracks.length; i++) if (snapshot.tracks[i].index === trackIndex) track = snapshot.tracks[i];
    if (!track || !ret || ret.routedToMain !== false || !track.sends[returnIndex] ||
        track.name !== expectedTrackName || ret.name !== expectedReturnName) return;
    try {
        // Recheck Live at the final write boundary, including edits before observer delivery.
        if (String(root.get('tracks')) !== trackIds || String(root.get('return_tracks')) !== returnIds) { schedule(); return; }
        api = new LiveAPI('live_set tracks ' + trackIndex);
        returnApi = new LiveAPI('live_set return_tracks ' + returnIndex);
        if (text(api, 'name') !== track.name || text(returnApi, 'name') !== ret.name || routedToMain(returnApi) !== false) { schedule(); return; }
        param = new LiveAPI('live_set tracks ' + trackIndex + ' mixer_device sends ' + returnIndex);
        param.set('value', value);
    } catch (e) { post('Setlist Touch send ignored: ' + e + '\n'); schedule(); }
    finally { release(api); release(returnApi); release(param); }
}
function notifydeleted() {
    active = false; dirty = true; generation++;
    if (debounce) debounce.cancel(); if (levelTask) levelTask.cancel();
    releaseAll(rootObservers); releaseAll(metadataObservers); releaseAll(sendObservers); release(root);
    levelsPending = false; root = null; snapshot = {returns:[], tracks:[]}; pendingLevels = {}; trackIds = ''; returnIds = '';
}
