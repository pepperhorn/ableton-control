// Classic Max js: ES5. Commands arrive through deferlow; observers only read.
autowatch = 1;
inlets = 1;
outlets = 1;
var root = null, observers = [], task = null, retry = null;
var active = false, building = false, pending = false, last = 0;
var properties = ['is_playing', 'record_mode', 'tempo', 'current_song_time', 'signature_numerator', 'signature_denominator'];
function release(api) {
    if (!api) return;
    try { api.property = ''; } catch (e) {}
    try { api.id = 0; } catch (e) {}
}
function changed() {
    if (!active || building || pending) return;
    pending = true;
    task.schedule(Math.max(0, 100 - (Date.now() - last)));
}
function flush() {
    pending = false;
    if (!active || !root || !root.id) return;
    try {
        var values = [], i, value;
        for (i = 0; i < properties.length; i++) {
            value = root.get(properties[i]);
            values.push(Number(Array.isArray(value) ? value[0] : value));
        }
        // Live accounts for earlier signature changes; keep the numeric fallback.
        var beats = '';
        try {
            beats = root.call('get_current_beats_song_time');
            beats = Array.isArray(beats) ? beats.join(' ') : String(beats);
        } catch (e) {}
        last = Date.now();
        outlet(0, 'transport', values[0], values[1], values[2], values[3], values[4], values[5], beats);
    } catch (e) { retry.schedule(1000); }
}
function refresh() {
    notifydeleted(); active = true; building = true; last = 0;
    task = new Task(flush, this); retry = new Task(refresh, this);
    try {
        root = new LiveAPI('live_set');
        for (var i = 0; i < properties.length; i++) {
            var api = new LiveAPI(changed, 'live_set');
            observers.push(api); api.property = properties[i];
        }
        building = false; changed();
    } catch (e) { building = false; retry.schedule(1000); }
}
function setPlaying(target) {
    if (!active || building || !root || !root.id) return;
    var command = target ? 'play' : 'stop';
    try {
        // Read Live at the deferred write boundary, never a cached observer value.
        var value = root.get('is_playing');
        value = Number(Array.isArray(value) ? value[0] : value);
        if (value === 1 - target) root.call(target ? 'start_playing' : 'stop_playing');
        else post('Setlist Touch ' + command + ' ignored: is_playing=' + value + '\n');
    } catch (e) { post('Setlist Touch ' + command + ' ignored: ' + e + '\n'); }
}
function play() { setPlaying(1); }
function stop() { setPlaying(0); }
function record(value) {
    if (active && !building && root && root.id && (value === 0 || value === 1)) root.set('record_mode', value);
}
function notifydeleted() {
    active = false; building = false; pending = false;
    if (task) task.cancel(); if (retry) retry.cancel();
    for (var i = 0; i < observers.length; i++) release(observers[i]);
    observers = []; release(root); root = null;
}
