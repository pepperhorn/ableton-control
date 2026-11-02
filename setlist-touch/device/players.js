// Classic Max js, ES5. All commands are routed through deferlow.
autowatch = 1;
inlets = 1;
outlets = 1;
var alive = true, replyDicts = {};
function forget(id) { delete replyDicts[id]; }
function read(api, key) {
    var raw = api.get(key);
    if (Array.isArray(raw)) raw = raw.join(' ');
    var value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (value && Object.prototype.hasOwnProperty.call(value, key)) value = value[key];
    return value;
}
function nameOf(api) { var v = api.get('name'); return Array.isArray(v) ? v.join(' ') : String(v); }
function external(value) { return value && /^ext\.? out$/i.test(value.display_name); }
function main(value) { return value && /^(main|master)$/i.test(value.display_name); }
function dispose(apis) { for (var i = 0; i < apis.length; i++) try { apis[i].id = 0; } catch (e) {} }
function report(id, result) {
    if (!alive) return;
    var dict = new Dict('setlist_touch_player_' + id);
    replyDicts[id] = dict;
    dict.set('result', JSON.stringify(result)); outlet(0, 'playerResult', id);
}
function outputs(id) {
    if (!alive) return;
    var apis = [], result = {types:[], channels:[], returns:[]};
    try {
        var root = new LiveAPI('live_set'); apis.push(root);
        var count = root.getcount('return_tracks');
        if (count !== Math.floor(count) || count > 12 || count < 0) throw Error('Unexpected return count');
        for (var i = 0; i < count; i++) {
            var api = new LiveAPI('live_set return_tracks ' + i); apis.push(api);
            var route = read(api, 'output_routing_type');
            result.returns.push({index:i, name:nameOf(api), type:route, channel:read(api, 'output_routing_channel')});
            if (!result.types.length) {
                var types = read(api, 'available_output_routing_types');
                if (!Array.isArray(types)) throw Error('Unreadable output types');
                result.types = types.filter(external);
            }
            if (external(route) && !result.channels.length) {
                var channels = read(api, 'available_output_routing_channels');
                if (!Array.isArray(channels)) throw Error('Unreadable output channels');
                result.channels = channels;
            }
        }
        // No return yet: master may expose external output types/channels without mutation.
        if (!count) {
            var master = new LiveAPI('live_set master_track'); apis.push(master);
            var offered = read(master, 'available_output_routing_types');
            if (Array.isArray(offered)) result.types = offered.filter(external);
            if (external(read(master, 'output_routing_type'))) result.channels = read(master, 'available_output_routing_channels');
        }
        report(id, {ok:true, outputs:result});
    } catch (e) { report(id, {ok:false, message:'Could not read Live outputs: ' + e}); }
    finally { dispose(apis); }
}
function add(id, name, typeId, channelId) {
    if (!alive) return;
    var apis = [], root, api, created = false, undo = false, actual = '';
    try {
        if (typeof name !== 'string' || !name.length || name.length > 200) throw Error('Invalid send name');
        root = new LiveAPI('live_set'); apis.push(root);
        var count = root.getcount('return_tracks'), index = -1;
        if (count !== Math.floor(count) || count > 12 || count < 0) throw Error('Unexpected return count');
        for (var i = 0; i < count; i++) {
            var candidate = new LiveAPI('live_set return_tracks ' + i); apis.push(candidate);
            if (nameOf(candidate) === name) { if (api) throw Error('More than one return has that name'); api = candidate; index = i; }
        }
        if (api) {
            var oldRoute = read(api, 'output_routing_type');
            if (main(oldRoute)) throw Error('This return is routed to Main and cannot be linked as a player.');
            if (!external(oldRoute)) throw Error('Return routing is not a known external output. Set it in Live first.');
        } else if (count === 12) throw Error('Live allows 12 returns. Link an existing player return.');
        try { root.call('begin_undo_step'); undo = true; } catch (e) { post('Setlist Touch: undo grouping unavailable\n'); }
        if (!api) {
            var before = String(root.get('return_tracks'));
            root.call('create_return_track');
            var after = String(root.get('return_tracks'));
            if (root.getcount('return_tracks') !== count + 1 || after === before || (before && after.indexOf(before + ',') !== 0)) throw Error('Live did not confirm return creation');
            created = true; index = count; api = new LiveAPI('live_set return_tracks ' + index); apis.push(api);
            api.set('name', name); actual = nameOf(api);
            if (!actual || actual.length > 200) throw Error('Live did not confirm the send name');
        } else actual = nameOf(api);
        var types = read(api, 'available_output_routing_types');
        if (!Array.isArray(types)) throw Error('Unreadable output types');
        var type = null;
        for (i = 0; i < types.length; i++) if (external(types[i]) && types[i].identifier !== undefined && String(types[i].identifier) === String(typeId)) type = types[i];
        if (!type || !type.identifier) throw Error('External output is unavailable');
        var route = read(api, 'output_routing_type');
        if (String((route || {}).identifier) !== String(typeId)) {
            if (!created && main(route)) throw Error('Main return cannot be rerouted');
            api.set('output_routing_type', JSON.stringify(type));
            route = read(api, 'output_routing_type');
            if (!external(route) || String(route.identifier) !== String(typeId)) throw Error('Live did not confirm external routing');
        }
        var channels = read(api, 'available_output_routing_channels'), channel = null;
        if (!Array.isArray(channels)) throw Error('Unreadable output channels');
        for (i = 0; i < channels.length; i++) if (channels[i].identifier !== undefined && String(channels[i].identifier) === String(channelId)) channel = channels[i];
        if (!channel || !channel.identifier) throw Error('Choose an output channel after refreshing outputs');
        if (String((read(api, 'output_routing_channel') || {}).identifier) !== String(channelId)) api.set('output_routing_channel', JSON.stringify(channel));
        if (String((read(api, 'output_routing_channel') || {}).identifier) !== String(channelId) || !external(read(api, 'output_routing_type')) || nameOf(api) !== actual) throw Error('Live did not confirm routing and name');
        report(id, {ok:true, returnName:actual});
    } catch (e) { report(id, {ok:false, message:String(e) + (created ? '. Return remains in Live; no member was added. Set its output in Live, refresh outputs, then Add again.' : '. No member was added.')}); }
    finally { if (undo) try { root.call('end_undo_step'); } catch (e) { post('Setlist Touch: undo end unavailable\n'); } dispose(apis); }
}
function notifydeleted() { alive = false; outlet(0, 'playerRemoved'); }
function refresh() { alive = true; }
