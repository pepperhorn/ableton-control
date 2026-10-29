// Classic Max js: ES5, observer-driven, no polling. Writes arrive via deferlow.
autowatch = 1;
inlets = 1;
outlets = 1;
var MIX_CHUNK = 1, MIX_TRACK_CHUNK = 12, MIX_SEND_CHUNK = 6, MIX_SLICE_MS = 15;
var scanTask = null, scan = null, retired = [];
var root = null, mixDict = null, debounce = null, levelTask = null;
var rootObservers = [], metadataObservers = [], sendObservers = [];
var active = false, building = false, dirty = true, generation = 0, levelsPending = false;
var snapshot = {returns:[], tracks:[]}, trackIds = '', returnIds = '', pendingLevels = {}, scanLevels = {};
var trackApis = {}, returnApis = {}, sendApis = {}, retryDelay = 1000, published = null;

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
    try { api.property = ''; } catch (e) {}
    try { api.id = 0; } catch (e) {}
}
function releaseAll(list) {
    for (var i = 0; i < list.length; i++) release(list[i]);
    list.length = 0;
}
function watch(path, property, callback, list) {
    var api = new LiveAPI(callback, path);
    list.push(api);
    try { api.property = property; }
    catch (e) { list.pop(); release(api); throw e; }
    return api;
}
// Unknown routing is excluded by parse-mix; never assume an unreadable route is external.
function routedToMain(api) {
    try {
        var raw = api.get('output_routing_type');
        if (Array.isArray(raw)) raw = raw.join(' ');
        var routing = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (routing && Object.prototype.hasOwnProperty.call(routing, 'output_routing_type')) routing = routing.output_routing_type;
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
    if (scanTask) scanTask.cancel();
    debounce.cancel(); debounce.schedule(200);
}
function ready() {
    if (!active) { refresh(); return; }
    if (published) outlet(0, 'mix');
}
function refresh() {
    if (debounce) debounce.cancel(); if (levelTask) levelTask.cancel(); if (scanTask) scanTask.cancel();
    releaseAll(rootObservers); release(root);
    active = true; retryDelay = 1000;
    root = new LiveAPI('live_set'); mixDict = new Dict('setlist_touch_mix');
    debounce = new Task(rebuild, this); levelTask = new Task(flushLevels, this);
    scanTask = new Task(scanTick, this);
    building = true;
    watch('live_set', 'tracks', schedule, rootObservers);
    watch('live_set', 'return_tracks', schedule, rootObservers);
    building = false; rebuild();
}
function valueChanged(trackIndex, returnIndex, api, version) {
    if (!active || building || (version !== generation && (!published || version !== published.generation)) || !api || !api.id) return;
    var entry = {trackIndex:trackIndex, returnIndex:returnIndex, api:api};
    if (!published || version !== published.generation) {
        scanLevels[trackIndex + ':' + returnIndex] = entry; return;
    }
    pendingLevels[trackIndex + ':' + returnIndex] = entry;
    // Published faders still echo at the usual cadence during a rescan.
    if (!levelsPending) { levelsPending = true; levelTask.schedule(33); }
}
function observeSend(path, trackIndex, returnIndex) {
    var version = generation, api;
    api = watch(path, 'value', function () { valueChanged(trackIndex, returnIndex, api, version); }, sendObservers);
    return api;
}
function flushLevels() {
    levelsPending = false;
    if (!active || building || !published) return;
    var pending = pendingLevels; pendingLevels = {};
    for (var key in pending) if (pending.hasOwnProperty(key)) {
        var entry = pending[key];
        try {
            if (!entry.api || !entry.api.id) continue;
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
    dirty = true; generation++; debounce.cancel(); scanTask.cancel();
    scanLevels = {};
    if (!published) { levelTask.cancel(); levelsPending = false; pendingLevels = {}; }
    if (!published || metadataObservers !== published.metadataObservers)
        retired = retired.concat(metadataObservers, sendObservers);
    metadataObservers = []; sendObservers = [];
    trackApis = {}; returnApis = {}; sendApis = {};
    scan = {next:{returns:[], tracks:[]}, index:0, phase:'returns'};
    try {
        trackIds = String(root.get('tracks')); returnIds = String(root.get('return_tracks'));
        scan.trackCount = root.getcount('tracks'); scan.returnCount = root.getcount('return_tracks');
        scanTask.schedule(MIX_SLICE_MS);
    } catch (e) { scanFailed(e); }
}
function scanFailed(error) {
    dirty = true; scan = null; scanLevels = {};
    if (!published || metadataObservers !== published.metadataObservers)
        retired = retired.concat(metadataObservers, sendObservers);
    metadataObservers = []; sendObservers = [];
    trackApis = {}; returnApis = {}; sendApis = {};
    debounce.cancel(); debounce.schedule(retryDelay); retryDelay = Math.min(8000, retryDelay * 2);
    if (!published) {
        snapshot = {returns:[], tracks:[]};
        mixDict.set('mix', JSON.stringify(snapshot)); outlet(0, 'mix');
    }
    post('Setlist Touch mix refresh: ' + error + '\n');
    if (retired.length) scanTask.schedule(MIX_SLICE_MS);
}
function scanTick() {
    if (!active) return;
    if (retired.length) {
        for (var r = 0; r < 30 && retired.length; r++) release(retired.pop());
        if (retired.length || scan) scanTask.schedule(MIX_SLICE_MS);
        return;
    }
    if (!scan) return;
    building = true;
    try {
        var next = scan.next, i, j, path, api, item, param, count = 0;
        if (scan.phase === 'returns') {
            for (; count < MIX_CHUNK && scan.index < scan.returnCount; count++, scan.index++) {
                j = scan.index; path = 'live_set return_tracks ' + j;
                api = watch(path, 'name', schedule, metadataObservers); returnApis[j] = api;
                item = {index:j, name:text(api, 'name'), color:Number(scalar(api, 'color')), routedToMain:routedToMain(api)};
                next.returns.push(item);
                watch(path, 'color', schedule, metadataObservers);
                watch(path, 'output_routing_type', schedule, metadataObservers);
            }
            if (scan.index === scan.returnCount) { scan.phase = 'tracks'; scan.index = 0; }
        } else if (scan.phase === 'tracks') {
            // Sends are their own phase, so even an unusually large return count stays bounded.
            for (; count < MIX_TRACK_CHUNK && scan.index < scan.trackCount; count++) {
                i = scan.index; path = 'live_set tracks ' + i;
                api = watch(path, 'name', schedule, metadataObservers); trackApis[i] = api;
                item = {index:i, name:text(api, 'name'), color:Number(scalar(api, 'color')), sends:[]};
                watch(path, 'color', schedule, metadataObservers);
                if (item.name.indexOf('+ ') === 0) {
                    next.tracks.push(item); scan.item = item; scan.sendIndex = 0; scan.phase = 'sends'; break;
                } else scan.index++;
            }
        } else {
            i = scan.index; item = scan.item;
            for (j = scan.sendIndex; j < scan.returnCount && count < MIX_SEND_CHUNK; j++, count++) {
                if (next.returns[j].routedToMain !== false) continue;
                param = null;
                try {
                    param = observeSend('live_set tracks ' + i + ' mixer_device sends ' + j, i, j);
                    item.sends[j] = readLevel(param);
                    if (item.sends[j]) sendApis[i + ':' + j] = param;
                    else release(param);
                } catch (e) { release(param); item.sends[j] = null; }
            }
            scan.sendIndex = j;
            if (j === scan.returnCount) { scan.index++; scan.phase = 'tracks'; }
        }
        if (scan.phase === 'tracks' && scan.index === scan.trackCount) {
            if (published) retired = retired.concat(published.metadataObservers, published.sendObservers);
            snapshot = next; scan = null; dirty = false;
            published = {trackApis:trackApis, returnApis:returnApis, sendApis:sendApis,
                trackIds:trackIds, returnIds:returnIds, metadataObservers:metadataObservers,
                sendObservers:sendObservers, generation:generation};
            for (var scanKey in scanLevels) if (scanLevels.hasOwnProperty(scanKey)) pendingLevels[scanKey] = scanLevels[scanKey];
            scanLevels = {};
            for (var pendingKey in pendingLevels) if (pendingLevels.hasOwnProperty(pendingKey))
                pendingLevels[pendingKey].api = sendApis[pendingKey];
            if (retired.length) scanTask.schedule(MIX_SLICE_MS);
            mixDict.set('mix', JSON.stringify(snapshot)); outlet(0, 'mix'); retryDelay = 1000;
            for (var key in pendingLevels) if (pendingLevels.hasOwnProperty(key)) {
                levelsPending = true; levelTask.schedule(33); break;
            }
        } else scanTask.schedule(MIX_SLICE_MS);
    } catch (e) { scanFailed(e); }
    finally { building = false; }
}
function send(trackIndex, returnIndex, value, expectedTrackName, expectedReturnName) {
    if (!active || building || !root || !published) return;
    trackIndex = Number(trackIndex); returnIndex = Number(returnIndex); value = Number(value);
    if (!isFinite(value) || value < 0 || value > 1 || trackIndex < 0 || returnIndex < 0 ||
        trackIndex !== Math.floor(trackIndex) || returnIndex !== Math.floor(returnIndex)) return;
    var track = null, ret = snapshot.returns[returnIndex], i;
    var api = published.trackApis[trackIndex], returnApi = published.returnApis[returnIndex], param = published.sendApis[trackIndex + ':' + returnIndex];
    for (i = 0; i < snapshot.tracks.length; i++) if (snapshot.tracks[i].index === trackIndex) track = snapshot.tracks[i];
    if (!track || !ret || ret.routedToMain !== false || !track.sends[returnIndex] ||
        track.name !== expectedTrackName || ret.name !== expectedReturnName ||
        !api || !api.id || !returnApi || !returnApi.id || !param || !param.id) return;
    try {
        // Recheck Live at the final write boundary, including edits before observer delivery.
        // Compare the target slots' IDs, so unrelated additions/removals do not
        // disable a still-valid fader. Moved/replaced targets always fail closed.
        var currentTracks = String(root.get('tracks')).split(','), currentReturns = String(root.get('return_tracks')).split(',');
        var expectedTracks = published.trackIds.split(','), expectedReturns = published.returnIds.split(',');
        if (currentTracks[trackIndex * 2 + 1] !== expectedTracks[trackIndex * 2 + 1] ||
            currentReturns[returnIndex * 2 + 1] !== expectedReturns[returnIndex * 2 + 1]) { if (!dirty) schedule(); return; }
        // Reuse the published generation until its replacement is complete.
        if (text(api, 'name') !== track.name || text(returnApi, 'name') !== ret.name || routedToMain(returnApi) !== false) { if (!dirty) schedule(); return; }
        param.set('value', value);
    } catch (e) { post('Setlist Touch send ignored: ' + e + '\n'); schedule(); }
}
function notifydeleted() {
    active = false; dirty = true; generation++;
    if (debounce) debounce.cancel(); if (levelTask) levelTask.cancel();
    if (scanTask) scanTask.cancel(); scan = null;
    // Max frees js-owned LiveAPI objects at teardown. Avoid a synchronous release
    // of both the published and in-flight generations; active guards callbacks.
    retired = []; rootObservers = []; metadataObservers = []; sendObservers = [];
    published = null;
    trackApis = {}; returnApis = {}; sendApis = {};
    levelsPending = false; root = null; snapshot = {returns:[], tracks:[]}; pendingLevels = {}; scanLevels = {}; trackIds = ''; returnIds = '';
}
