// Classic Max js (ES5). Bound synchronous LiveAPI work to small Task slices.
autowatch = 1;
inlets = 1;
outlets = 1;
var CHUNK = 3, SLICE_MS = 15, PROGRESS_MS = 120, SWEEP_MS = 1000;
var root = null, scenesDict = null, work = null, sweep = null, retry = null;
var rootObservers = [], sceneObservers = [], trackObservers = [], retired = [];
var positionObserver = null, timingPath = null, timingCount = 0, timingOwn = false;
var rows = [], overrides = [], playing = -1, fired = -1;
var positionKey = '', rowsJSON = null, active = false, subscribing = false;
var scan = null, generation = 0, dirtyScenes = {}, dirtyTiming = {}, sweepIndex = 0;
var playbackPending = false, sceneIds = '', trackIds = '', priorityTiming = {};
var retryDelay = 1000, retryPending = false, lastProgress = null;
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
    if (active && !retryPending) { work.cancel(); work.schedule(delay || SLICE_MS); }
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
function progress(done, total) {
    lastProgress = [done, total]; outlet(0, 'progress', done, total);
}
function ready() {
    if (!active) { refresh(); return; }
    if (rowsJSON !== null) outlet(0, 'scenes');
    if (lastProgress) outlet(0, 'progress', lastProgress[0], lastProgress[1]);
    playbackChanged();
}
function refresh() {
    stopBuild("Device refreshed");
    // Explicit refresh restarts indexing; Node ready only replays cached state.
    // Cancel immediately, but drain the many scene observers in bounded work ticks.
    if (work) work.cancel(); if (sweep) sweep.cancel(); if (retry) retry.cancel();
    retired = retired.concat(sceneObservers); sceneObservers = [];
    releaseAll(rootObservers); releaseAll(trackObservers); release(positionObserver); release(root);
    positionObserver = null; positionKey = ''; timingPath = null; rowsJSON = null;
    active = true; retryPending = false; retryDelay = 1000; lastProgress = null;
    root = new LiveAPI('live_set'); scenesDict = new Dict('setlist_touch_scenes');
    work = new Task(workTick, this); sweep = new Task(sweepTick, this); retry = new Task(retryRebuild, this);
    watch('live_set', 'scenes', rebuild, rootObservers);
    watch('live_set', 'tracks', tracksChanged, rootObservers);
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
    stopBuild("Set structure changed; build stopped");
    generation++; work.cancel();
    retired = retired.concat(sceneObservers); sceneObservers = [];
    dirtyScenes = {}; dirtyTiming = {}; priorityTiming = {}; signatureDirty = false;
    sceneIds = String(root.get('scenes')); timingCount = root.getcount('scenes');
    readSignature(); bindTiming();
    scan = {index:0, total:timingCount, rows:[], overrides:[]};
    progressElapsed = 0; progress(0, timingCount);
    requestWork(); playbackChanged();
}
function resolveOwnTrack(ids) {
    var parent = null;
    try {
        parent = new LiveAPI('this_device canonical_parent');
        var id = Number(parent.id);
        if (!(id > 0)) return null;
        for (var i = 0; i < ids.length; i += 2)
            if (Number(ids[i + 1]) === id) return 'live_set tracks ' + (i / 2);
    } catch (e) {} finally { release(parent); }
    return null;
}
function timingRefused(id) {
    var message = 'Timing clips need the device on its own MIDI track. Fallback timing is read only; Build refused.';
    post('Setlist Touch: ' + message + '\n');
    timingReport(id, {ok:false, message:message});
}
function bindTiming() {
    var count = root.getcount('tracks');
    releaseAll(trackObservers); release(positionObserver); positionObserver = null; positionKey = '';
    var ids = root.get('tracks');
    trackIds = String(ids);
    var ownPath = resolveOwnTrack(ids);
    timingOwn = ownPath !== null;
    if (!timingOwn) post('Setlist Touch: device is not on a regular track; timing falls back to last regular track (read only)\n');
    timingPath = timingOwn ? ownPath : count ? 'live_set tracks ' + (count - 1) : null;
    if (timingPath) {
        watch(timingPath, 'playing_slot_index', playbackChanged, trackObservers);
        watch(timingPath, 'fired_slot_index', playbackChanged, trackObservers);
    }
}
function tracksChanged() {
    if (!active || subscribing || retryPending) return;
    stopBuild('Set structure changed; build stopped');
    if (String(root.get('scenes')) !== sceneIds) { rebuild(); return; }
    bindTiming();
    var target = scan ? scan.rows : rows;
    for (var i = 0; i < target.length; i++) dirtyTiming[i] = true;
    playbackChanged(); requestWork();
}
function retryRebuild() {
    if (!active) return;
    retryPending = false;
    try { rebuild(); } catch (e) { workFailed(e); }
}
function workFailed(error) {
    stopBuild('Build stopped after scene refresh error: ' + error);
    work.cancel(); retryPending = true;
    post('Setlist Touch refresh (retry in ' + retryDelay + ' ms): ' + error + '\n');
    retry.cancel(); retry.schedule(retryDelay); retryDelay = Math.min(8000, retryDelay * 2);
}
function hasEntries(map) { for (var key in map) if (map.hasOwnProperty(key)) return true; return false; }
function workTick() {
    if (!active || retryPending) return;
    try {
        // Alternate whole slices so normal scene/priority work is never stacked
        // on a build slice, and neither queue can starve the other.
        if (build && !buildNormalTurn) { buildNormalTurn = true; buildTick(); return; }
        buildNormalTurn = false;
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
                progress(scan.index, scan.total); progressElapsed = 0;
            }
        } else {
            for (key in dirtyScenes) if (dirtyScenes.hasOwnProperty(key) && count < CHUNK) {
                i = Number(key); delete dirtyScenes[key];
                if (i < target.length) { readScene(i, target, signatures); count++; }
            }
            for (var priority = 2; priority > 0; priority--)
                for (key in priorityTiming) if (priorityTiming.hasOwnProperty(key) && priorityTiming[key] === priority && count < CHUNK) {
                    i = Number(key); delete priorityTiming[key]; delete dirtyTiming[key];
                    if (i < target.length) { target[i].loopBeats = loopAt(i); count++; }
                }
            for (key in dirtyTiming) if (dirtyTiming.hasOwnProperty(key) && count < CHUNK) {
                i = Number(key); delete dirtyTiming[key];
                if (i < target.length) { target[i].loopBeats = loopAt(i); count++; }
            }
        }
        // Signature defaults are cached; no per-scene LiveAPI reads on a global change.
        for (i = 0; i < target.length; i++) if (signatures[i] === null) target[i].beatsPerBar = songBeats;
        if (scan && scan.index === scan.total && !hasEntries(dirtyScenes) && !hasEntries(dirtyTiming) && !hasEntries(priorityTiming)) {
            rows = target; overrides = signatures;
            var total = scan.total; scan = null; publish(); progress(total, total); retryDelay = 1000;
            // Playback is a separate bounded tick from the last scene slice.
            playbackPending = true; requestWork(); return;
        }
        if (!scan) { publish(); retryDelay = 1000; }
        if (build || scan || hasEntries(dirtyScenes) || hasEntries(dirtyTiming) || hasEntries(priorityTiming)) requestWork();
    } catch (e) {
        workFailed(e);
    }
}
function sweepTick() {
    if (!active) return;
    if (!retryPending && !scan && rows.length) {
        for (var i = 0; i < CHUNK; i++) {
            dirtyTiming[sweepIndex] = true; sweepIndex = (sweepIndex + 1) % rows.length;
        }
        requestWork();
    }
    sweep.schedule(SWEEP_MS);
}
function queueSong(index) {
    if (index < 0 || index >= rows.length) return;
    priorityTiming[index] = 2;
    var start = index, end = index + 1;
    while (start > 0 && !/^\*\s/.test(rows[start].name)) start--;
    if (!/^\*\s/.test(rows[start].name) || /^\*\s*\[\[/.test(rows[start].name)) return;
    while (end < rows.length && !/^\*\s/.test(rows[end].name)) end++;
    for (var i = start; i < end; i++) if (priorityTiming[i] !== 2) priorityTiming[i] = 1;
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
    stopBuild("Device removed");
    active = false; generation++;
    if (work) work.cancel(); if (sweep) sweep.cancel(); if (retry) retry.cancel();
    // Max destroys the js-owned LiveAPI objects. Guards above make callbacks inert;
    // explicit refresh still drains obsolete scene subscriptions in bounded slices.
    rootObservers = []; sceneObservers = []; trackObservers = []; retired = [];
    root = null; positionObserver = null; positionKey = ''; timingPath = null; timingCount = 0; timingOwn = false;
    rows = []; overrides = []; scan = null; playing = -1; fired = -1; rowsJSON = null;
    dirtyScenes = {}; dirtyTiming = {}; priorityTiming = {}; sweepIndex = 0; playbackPending = false;
    retryPending = false; lastProgress = null; sceneIds = '';
}

// The builder shares work with indexing: six source tracks OR one commit per tick.
// No automatic retries after a mutation: a failed build reports its partial counts.
var build = null, buildReplies = {}, buildNormalTurn = false;
function timingCancel(id) { if (build && build.id === id) { stopBuild('Build cancelled after reply timeout'); requestWork(); } }
function timingForget(id) { delete buildReplies[id]; }
function timingReport(id, result) {
    var dict = new Dict('setlist_touch_timing_' + id);
    buildReplies[id] = dict; dict.set('result', JSON.stringify(result));
    outlet(0, 'timingResult', id);
}
function buildProgress() {
    outlet(0, 'timingProgress', build.row, build.total);
}
function stopBuild(message) {
    if (!build) return;
    var b = build; build = null;
    timingReport(b.id, {ok:!message, message:message || '', created:b.created,
        existing:b.existing, noSource:b.noSource, unnamed:b.unnamed, done:b.row, total:b.total});
}
function timingBuild(id, confirmPlaying) {
    if (!timingOwn) { timingRefused(id); return; }
    if (build || scan || retryPending || !active || !timingPath) {
        timingReport(id, {ok:false, message:'Indexing or another build is in progress; wait until Live is ready'}); return;
    }
    try {
        if (Number(scalar(root, 'is_playing')) !== 0 && Number(confirmPlaying) !== 1) {
            timingReport(id, {ok:false, message:'Live is playing. Confirm building while playing.'}); return;
        }
        if (String(root.get('scenes')) !== sceneIds || String(root.get('tracks')) !== trackIds) {
            timingReport(id, {ok:false, message:'Set structure changed; wait for indexing'}); return;
        }
        if (resolveOwnTrack(root.get('tracks')) !== timingPath) { timingRefused(id); return; }
        var track = new LiveAPI(timingPath), midi;
        try { midi = Number(scalar(track, 'has_midi_input')) === 1; } finally { release(track); }
        if (!midi) { timingReport(id, {ok:false, message:'Timing track must be a MIDI track'}); return; }
        build = {id:id, row:0, total:timingCount, tracks:root.getcount('tracks'), track:0,
            scenes:String(root.get('scenes')), ids:String(root.get('tracks')), path:timingPath,
            own:timingOwn, longest:0, phase:'start', created:0, existing:0, noSource:0, unnamed:0, elapsed:0};
        buildNormalTurn = false;
        buildProgress(); requestWork();
    } catch (e) { if (build) stopBuild(String(e)); else timingReport(id, {ok:false,message:String(e)}); }
}
function buildTick() {
    var b = build, slot = null, clip = null;
    try {
        if (!b.own || !timingOwn || timingPath !== b.path || resolveOwnTrack(root.get('tracks')) !== b.path) {
            post('Setlist Touch: timing clips need the device on its own MIDI track; build stopped\n');
            stopBuild('Timing clips need the device on its own MIDI track; build stopped'); requestWork(); return;
        }
        if (String(root.get('scenes')) !== b.scenes || String(root.get('tracks')) !== b.ids) {
            stopBuild('Set structure changed; build stopped'); requestWork(); return;
        }
        if (b.row === b.total) { stopBuild(''); requestWork(); return; }
        var path = b.path + ' clip_slots ' + b.row;
        if (b.phase === 'start') {
            slot = new LiveAPI(path);
            if (Number(scalar(slot, 'has_clip')) === 1) { b.existing++; finishBuildRow(); }
            else { b.phase = 'sources'; b.track = 0; b.longest = 0; }
        } else if (b.phase === 'sources') {
            for (var n = 0; n < 6 && b.track < b.tracks; n++, b.track++) {
                var source = 'live_set tracks ' + b.track;
                if (source === b.path) continue;
                slot = new LiveAPI(source + ' clip_slots ' + b.row);
                if (Number(scalar(slot, 'has_clip')) === 1) {
                    clip = new LiveAPI(source + ' clip_slots ' + b.row + ' clip');
                    if (beatTiming(clip)) {
                        var length = Number(scalar(clip, 'loop_end')) - Number(scalar(clip, 'loop_start'));
                        if (isFinite(length) && length > b.longest) b.longest = length;
                    }
                    release(clip); clip = null;
                }
                release(slot); slot = null;
            }
            if (b.track === b.tracks) b.phase = 'create';
        } else {
            // Fresh slot and has_clip read immediately before the only create call.
            slot = new LiveAPI(path);
            if (Number(scalar(slot, 'has_clip')) === 1) b.existing++;
            else if (!(b.longest > 0)) b.noSource++;
            else {
                slot.call('create_clip', b.longest);
                if (Number(scalar(slot, 'has_clip')) !== 1) throw Error('Live did not confirm clip creation; check the slot in Live');
                b.created++; // Count creation even if the subsequent name set fails.
                clip = new LiveAPI(path + ' clip');
                var name = '\u23f1 ' + (Math.round(b.longest / rows[b.row].beatsPerBar * 100) / 100) + ' bars';
                // Naming is cosmetic. A missing/normalised name must not stop a build.
                try {
                    clip.set('name', name);
                    if (text(clip, 'name') !== name) throw Error('name readback mismatch');
                } catch (nameError) {
                    b.unnamed++;
                    post('Setlist Touch: timing clip name warning at scene ' + b.row + ': ' + nameError + '\n');
                }
                dirtyTiming[b.row] = true;
            }
            finishBuildRow();
        }
        b.elapsed += SLICE_MS;
        if (b.elapsed >= PROGRESS_MS) { buildProgress(); b.elapsed = 0; }
        requestWork();
    } catch (e) { stopBuild('Build stopped: ' + e); requestWork(); }
    finally { release(slot); release(clip); }
}
function finishBuildRow() { build.row++; build.phase = 'start'; }
