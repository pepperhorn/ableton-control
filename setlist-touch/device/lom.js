// Classic Max js (ES5). All LiveAPI work starts after live.thisdevice/Node ready.
autowatch = 1;
inlets = 1;
outlets = 1;
var root = null, scenesDict = null, debounce = null, poll = null;
var rootObservers = [], sceneObservers = [], trackObservers = [];
var positionObserver = null, sceneStructure = '', trackStructure = '';
var timingPath = null, rows = [], playing = -1, fired = -1;
var positionKey = '', building = false, active = false;

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
    var i;
    for (i = 0; i < list.length; i++) release(list[i]);
    list.length = 0;
}
function watch(path, property, callback, list) {
    var api = new LiveAPI(callback, path);
    api.property = property;
    list.push(api);
    return api;
}
function schedule() {
    if (!active || building) return;
    debounce.cancel();
    debounce.schedule(200);
}
function refresh() {
    notifydeleted();
    active = true;
    root = new LiveAPI('live_set');
    scenesDict = new Dict('setlist_touch_scenes');
    debounce = new Task(rebuild, this);
    poll = new Task(rebuild, this);
    poll.interval = 5000;
    building = true;
    watch('live_set', 'scenes', schedule, rootObservers);
    watch('live_set', 'tracks', schedule, rootObservers);
    watch('live_set', 'signature_numerator', schedule, rootObservers);
    watch('live_set', 'signature_denominator', schedule, rootObservers);
    building = false;
    rebuild();
    poll.repeat();
}
function clipAt(index) {
    if (!timingPath || index < 0 || index >= rows.length) return null;
    var path = timingPath + ' clip_slots ' + index;
    var slot = new LiveAPI(path);
    var hasClip = Number(scalar(slot, 'has_clip')) === 1;
    release(slot);
    return hasClip ? new LiveAPI(path + ' clip') : null;
}
function rebuild() {
    if (!active || building) return;
    building = true;
    try {
        var sceneIds = root.get('scenes'), trackIds = root.get('tracks');
        var sceneKey = String(sceneIds), trackKey = String(trackIds);
        var sceneCount = root.getcount('scenes'), trackCount = root.getcount('tracks');
        var changedScenes = sceneKey !== sceneStructure;
        var changedTracks = trackKey !== trackStructure;
        timingPath = trackCount ? 'live_set tracks ' + (trackCount - 1) : null;
        var songNumerator = Number(scalar(root, 'signature_numerator'));
        var songDenominator = Number(scalar(root, 'signature_denominator'));
        var next = [], i, scene, clip, enabled, numerator, denominator, loopStart, loopEnd;
        // clipAt uses the current scene count while the list is being rebuilt.
        rows.length = sceneCount;
        for (i = 0; i < sceneCount; i++) {
            scene = new LiveAPI('live_set scenes ' + i);
            enabled = Number(scalar(scene, 'time_signature_enabled')) === 1;
            numerator = enabled ? Number(scalar(scene, 'time_signature_numerator')) : songNumerator;
            denominator = enabled ? Number(scalar(scene, 'time_signature_denominator')) : songDenominator;
            clip = clipAt(i);
            loopStart = clip ? Number(scalar(clip, 'loop_start')) : 0;
            loopEnd = clip ? Number(scalar(clip, 'loop_end')) : 0;
            next.push({index:i, name:text(scene, 'name'), color:Number(scalar(scene, 'color')),
                loopBeats:clip && loopEnd > loopStart ? loopEnd - loopStart : null,
                beatsPerBar:numerator > 0 && denominator > 0 ? numerator * 4 / denominator : 4});
            release(scene); release(clip);
        }
        rows = next;
        scenesDict.set('scenes', JSON.stringify(rows));
        outlet(0, 'scenes');
        if (changedScenes) {
            releaseAll(sceneObservers);
            for (i = 0; i < sceneCount; i++) {
                watch('live_set scenes ' + i, 'name', schedule, sceneObservers);
                watch('live_set scenes ' + i, 'color', schedule, sceneObservers);
                watch('live_set scenes ' + i, 'time_signature_enabled', schedule, sceneObservers);
                watch('live_set scenes ' + i, 'time_signature_numerator', schedule, sceneObservers);
                watch('live_set scenes ' + i, 'time_signature_denominator', schedule, sceneObservers);
            }
            sceneStructure = sceneKey;
        }
        if (changedTracks) {
            releaseAll(trackObservers);
            release(positionObserver); positionObserver = null; positionKey = '';
            if (timingPath) {
                watch(timingPath, 'playing_slot_index', playbackChanged, trackObservers);
                watch(timingPath, 'fired_slot_index', playbackChanged, trackObservers);
            }
            trackStructure = trackKey;
        }
    } catch (e) { post('Setlist Touch refresh: ' + e + '\n'); }
    building = false;
    playbackChanged();
}
function slotIndex(value) {
    value = Number(value);
    return value >= 0 && value < rows.length && value === Math.floor(value) ? value : -1;
}
function playbackChanged() {
    if (!active || building) return;
    try {
        var track = timingPath ? new LiveAPI(timingPath) : null;
        var p = track ? slotIndex(scalar(track, 'playing_slot_index')) : -1;
        var f = track ? slotIndex(scalar(track, 'fired_slot_index')) : -1;
        release(track);
        var clip = clipAt(p), queued = clipAt(f);
        // Empty timing slots never acquire playing/queued outlines.
        playing = clip ? p : -1;
        fired = queued ? f : -1;
        release(queued);
        outlet(0, 'play', playing, fired);
        var key = clip ? timingPath + ':' + p + ':' + clip.id : '';
        if (key !== positionKey) {
            release(positionObserver); positionObserver = null;
            positionKey = key;
            if (clip) {
                positionObserver = new LiveAPI(positionChanged, timingPath + ' clip_slots ' + p + ' clip');
                positionObserver.property = 'playing_position';
            }
        }
        release(clip);
        positionChanged();
    } catch (e) { post('Setlist Touch playback: ' + e + '\n'); }
}
function positionChanged() {
    if (!active || building || playing < 0 || !positionObserver || !rows[playing]) return;
    try {
        outlet(0, 'pos', playing, Number(scalar(positionObserver, 'playing_position')),
            Number(scalar(positionObserver, 'loop_start')), Number(scalar(positionObserver, 'loop_end')),
            rows[playing].beatsPerBar);
    } catch (e) { schedule(); }
}
function fire(index) {
    if (!active || !root) return;
    index = Number(index);
    if (index < 0 || index !== Math.floor(index) || index >= root.getcount('scenes')) return;
    var scene = new LiveAPI('live_set scenes ' + index);
    scene.call('fire');
    release(scene);
}
function notifydeleted() {
    active = false;
    if (debounce) debounce.cancel();
    if (poll) poll.cancel();
    releaseAll(rootObservers); releaseAll(sceneObservers); releaseAll(trackObservers);
    release(positionObserver); release(root);
    root = null; positionObserver = null; sceneStructure = ''; trackStructure = ''; positionKey = '';
    timingPath = null; rows = []; playing = -1; fired = -1;
}
