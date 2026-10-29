// Classic Max js (ES5). Bound synchronous LiveAPI work to small Task slices.
autowatch = 1;
inlets = 1;
outlets = 1;
var CHUNK = 3, SLICE_MS = 15, PROGRESS_MS = 120, SWEEP_MS = 1000;
var root = null, scenesDict = null, work = null, sweep = null;
var rootObservers = [], sceneObservers = [], trackObservers = [], retired = [];
var positionObserver = null, timingPath = null, timingCount = 0;
var rows = [], overrides = [], playing = -1, fired = -1;
var positionKey = '', rowsJSON = null, active = false, subscribing = false;
var scan = null, generation = 0, dirtyScenes = {}, dirtyTiming = {}, sweepIndex = 0;
var playbackPending = false;
var songBeats = 4, signatureDirty = false, progressElapsed = 0;

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
    while (list.length) release(list.pop());
}
function watch(path, property, callback, list) {
    var api = null, previous = subscribing;
    subscribing = true;
    try {
        api = new LiveAPI(callback, path);
        list.push(api); api.property = property;
        return api;
    } catch (e) {
        if (api) { list.pop(); release(api); }
        throw e;
    } finally { subscribing = previous; }
}
function requestWork(delay) {
    if (active) { work.cancel(); work.schedule(delay || SLICE_MS); }
}
function readSignature() {
    var n = Number(scalar(root, 'signature_numerator'));
    var d = Number(scalar(root, 'signature_denominator'));
    songBeats = n > 0 && d > 0 ? n * 4 / d : 4;
}
function signatureChanged() {
    if (!active || subscribing) return;
    signatureDirty = true; requestWork();
}
function sceneChanged(index, version) {
    if (!active || subscribing || version !== generation) return;
    dirtyScenes[index] = true; requestWork(200);
}
function observeScene(index) {
    var version = generation, path = 'live_set scenes ' + index;
    var callback = function () { sceneChanged(index, version); };
    watch(path, 'name', callback, sceneObservers);
    watch(path, 'color', callback, sceneObservers);
    watch(path, 'time_signature_enabled', callback, sceneObservers);
    watch(path, 'time_signature_numerator', callback, sceneObservers);
    watch(path, 'time_signature_denominator', callback, sceneObservers);
}
function refresh() {
    // Refresh may arrive after Node starts while another scan is running.
    // Cancel immediately, but drain the many scene observers in bounded work ticks.
    if (work) work.cancel(); if (sweep) sweep.cancel();
    retired = retired.concat(sceneObservers); sceneObservers = [];
    releaseAll(rootObservers); releaseAll(trackObservers); release(positionObserver); release(root);
    positionObserver = null; positionKey = ''; timingPath = null; rowsJSON = null;
    active = true;
    root = new LiveAPI('live_set'); scenesDict = new Dict('setlist_touch_scenes');
    work = new Task(workTick, this); sweep = new Task(sweepTick, this);
    watch('live_set', 'scenes', rebuild, rootObservers);
    watch('live_set', 'tracks', rebuild, rootObservers);
    watch('live_set', 'signature_numerator', signatureChanged, rootObservers);
    watch('live_set', 'signature_denominator', signatureChanged, rootObservers);
    rebuild(); sweep.schedule(SWEEP_MS);
}
function clipAt(index) {
    if (!timingPath || index < 0 || index >= timingCount) return null;
    var path = timingPath + ' clip_slots ' + index, slot = null;
    try {
        slot = new LiveAPI(path);
        return Number(scalar(slot, 'has_clip')) === 1 ? new LiveAPI(path + ' clip') : null;
    } finally { release(slot); }
}
function beatTiming(clip) {
    return Number(scalar(clip, 'is_audio_clip')) === 0 || Number(scalar(clip, 'warping')) === 1;
}
function loopAt(index) {
    var clip = null;
    try {
        clip = clipAt(index);
        if (!clip || !beatTiming(clip)) return null;
        var start = Number(scalar(clip, 'loop_start')), end = Number(scalar(clip, 'loop_end'));
        return end > start ? end - start : null;
    } finally { release(clip); }
}
function readScene(index, target, signatures) {
    var scene = new LiveAPI('live_set scenes ' + index);
    try {
        var enabled = Number(scalar(scene, 'time_signature_enabled')) === 1;
        var n = enabled ? Number(scalar(scene, 'time_signature_numerator')) : 0;
        var d = enabled ? Number(scalar(scene, 'time_signature_denominator')) : 0;
        signatures[index] = enabled ? (n > 0 && d > 0 ? n * 4 / d : 4) : null;
        target[index] = {index:index, name:text(scene, 'name'), color:Number(scalar(scene, 'color')),
            loopBeats:loopAt(index), beatsPerBar:signatures[index] === null ? songBeats : signatures[index]};
    } finally { release(scene); }
}
function publish() {
    var serialized = JSON.stringify(rows);
    if (serialized === rowsJSON) return;
    scenesDict.set('scenes', serialized); rowsJSON = serialized; outlet(0, 'scenes');
}
function rebuild() {
    if (!active || subscribing) return;
    // Retire old generations in bounded batches; their callbacks are inert immediately.
    generation++; work.cancel();
    retired = retired.concat(sceneObservers); sceneObservers = [];
    dirtyScenes = {}; dirtyTiming = {}; signatureDirty = false;
    timingCount = root.getcount('scenes');
    var count = root.getcount('tracks'), path = count ? 'live_set tracks ' + (count - 1) : null;
    readSignature();
    releaseAll(trackObservers); release(positionObserver); positionObserver = null; positionKey = '';
    timingPath = path;
    if (timingPath) {
        watch(timingPath, 'playing_slot_index', playbackChanged, trackObservers);
        watch(timingPath, 'fired_slot_index', playbackChanged, trackObservers);
    }
    scan = {index:0, total:timingCount, rows:[], overrides:[]};
    progressElapsed = 0; outlet(0, 'progress', 0, timingCount);
    requestWork(); playbackChanged();
}
function hasEntries(map) { for (var key in map) if (map.hasOwnProperty(key)) return true; return false; }
function workTick() {
    if (!active) return;
    try {
        // At most 30 releases (60 property/id writes), with no scene reads this tick.
        if (retired.length) {
            for (var r = 0; r < CHUNK * 10 && retired.length; r++) release(retired.pop());
            requestWork(); return;
        }
        if (playbackPending) { playbackPending = false; playbackChanged(); return; }
        var i, key, count = 0, target = scan ? scan.rows : rows, signatures = scan ? scan.overrides : overrides;
        if (signatureDirty) { readSignature(); signatureDirty = false; }
        if (scan && scan.index < scan.total) {
            for (; count < CHUNK && scan.index < scan.total; count++, scan.index++) {
                i = scan.index; readScene(i, target, signatures); observeScene(i); delete dirtyScenes[i];
            }
            progressElapsed += SLICE_MS;
            if (scan.index < scan.total && progressElapsed >= PROGRESS_MS) {
                outlet(0, 'progress', scan.index, scan.total); progressElapsed = 0;
            }
        } else {
            for (key in dirtyScenes) if (dirtyScenes.hasOwnProperty(key) && count < CHUNK) {
                i = Number(key); delete dirtyScenes[key];
                if (i < target.length) { readScene(i, target, signatures); count++; }
            }
            for (key in dirtyTiming) if (dirtyTiming.hasOwnProperty(key) && count < CHUNK) {
                i = Number(key); delete dirtyTiming[key];
                if (i < target.length) { target[i].loopBeats = loopAt(i); count++; }
            }
        }
        // Signature defaults are cached; no per-scene LiveAPI reads on a global change.
        for (i = 0; i < target.length; i++) if (signatures[i] === null) target[i].beatsPerBar = songBeats;
        if (scan && scan.index === scan.total && !hasEntries(dirtyScenes) && !hasEntries(dirtyTiming)) {
            rows = target; overrides = signatures;
            var total = scan.total; scan = null; publish(); outlet(0, 'progress', total, total);
            // Playback is a separate bounded tick from the last scene slice.
            playbackPending = true; requestWork(); return;
        }
        if (!scan) publish();
        if (scan || hasEntries(dirtyScenes) || hasEntries(dirtyTiming)) requestWork();
    } catch (e) {
        post('Setlist Touch refresh: ' + e + '\n');
        // Keep the last complete snapshot. Retry from a clean generation.
        rebuild();
    }
}
function sweepTick() {
    if (!active) return;
    if (!scan && rows.length) {
        for (var i = 0; i < CHUNK; i++) {
            dirtyTiming[sweepIndex] = true; sweepIndex = (sweepIndex + 1) % rows.length;
        }
        requestWork();
    }
    sweep.schedule(SWEEP_MS);
}
function queueSong(index) {
    if (index < 0 || index >= rows.length) return;
    dirtyTiming[index] = true;
    var start = index, end = index + 1;
    while (start > 0 && !/^\*\s/.test(rows[start].name)) start--;
    if (!/^\*\s/.test(rows[start].name) || /^\*\s*\[\[/.test(rows[start].name)) return;
    while (end < rows.length && !/^\*\s/.test(rows[end].name)) end++;
    for (var i = start; i < end; i++) dirtyTiming[i] = true;
}
function slotIndex(value) {
    value = Number(value);
    return value >= 0 && value < timingCount && value === Math.floor(value) ? value : -1;
}
function playbackChanged() {
    if (!active || subscribing) return;
    var track = null, clip = null, queued = null;
    try {
        track = timingPath ? new LiveAPI(timingPath) : null;
        var p = track ? slotIndex(scalar(track, 'playing_slot_index')) : -1;
        var f = track ? slotIndex(scalar(track, 'fired_slot_index')) : -1;
        clip = clipAt(p); queued = clipAt(f);
        playing = clip ? p : -1; fired = queued ? f : -1;
        outlet(0, 'play', playing, fired);
        var key = clip ? timingPath + ':' + p + ':' + clip.id : '';
        if (key !== positionKey) {
            release(positionObserver); positionObserver = null; positionKey = key;
            if (clip) positionObserver = watch(timingPath + ' clip_slots ' + p + ' clip', 'playing_position', positionChanged, []);
        }
        queueSong(playing); queueSong(fired); requestWork(); positionChanged();
    } catch (e) { post('Setlist Touch playback: ' + e + '\n'); }
    finally { release(track); release(clip); release(queued); }
}
function positionChanged() {
    if (!active || subscribing || playing < 0 || !positionObserver || !rows[playing]) return;
    try {
        var beats = beatTiming(positionObserver);
        outlet(0, 'pos', playing, beats ? Number(scalar(positionObserver, 'playing_position')) : 0,
            beats ? Number(scalar(positionObserver, 'loop_start')) : 0,
            beats ? Number(scalar(positionObserver, 'loop_end')) : 0, rows[playing].beatsPerBar);
    } catch (e) { dirtyTiming[playing] = true; requestWork(); }
}
function fire(index, expectedName) {
    if (!active || !root) return;
    index = Number(index);
    if (index < 0 || index !== Math.floor(index) || index >= root.getcount('scenes')) return;
    var scene = new LiveAPI('live_set scenes ' + index);
    try {
        // Node sends the exact name as one symbol, including spaces/empty names.
        // Check at the final boundary: our last snapshot can trail Live edits.
        if (typeof expectedName !== 'string' || text(scene, 'name') !== expectedName) {
            post('Setlist Touch stale fire ignored at scene ' + index + '\n');
            return;
        }
        scene.call('fire');
    } catch (e) { post('Setlist Touch fire ignored: ' + e + '\n'); }
    finally { release(scene); }
}
function notifydeleted() {
    active = false; generation++;
    if (work) work.cancel(); if (sweep) sweep.cancel();
    releaseAll(rootObservers); releaseAll(sceneObservers); releaseAll(trackObservers); releaseAll(retired);
    release(positionObserver); release(root);
    root = null; positionObserver = null; positionKey = ''; timingPath = null; timingCount = 0;
    rows = []; overrides = []; scan = null; playing = -1; fired = -1; rowsJSON = null;
    dirtyScenes = {}; dirtyTiming = {}; sweepIndex = 0; playbackPending = false;
}
