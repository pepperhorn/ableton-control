// SceneNav.js — launch next / previous scene relative to the selected scene.
// Messages: next, prev, launch (re-fire selected), refresh, wrap <0|1>

autowatch = 1;
inlets = 1;
outlets = 1;

var wrapAround = 0;

function wrap(v) {
	wrapAround = v ? 1 : 0;
}

function selectedIndex() {
	var view = new LiveAPI("live_set view");
	var sel = view.get("selected_scene"); // ["id", N]
	if (!sel || sel.length < 2 || Number(sel[1]) === 0) return -1;
	var scene = new LiveAPI("live_set");
	scene.id = Number(sel[1]);
	var m = /scenes (\d+)/.exec(scene.unquotedpath);
	return m ? parseInt(m[1], 10) : -1;
}

function sceneCount() {
	return new LiveAPI("live_set").getcount("scenes");
}

function show(index) {
	if (index < 0) {
		outlet(0, "set", "—");
		return;
	}
	var scene = new LiveAPI("live_set scenes " + index);
	var name = scene.get("name");
	name = name ? String(name).replace(/^"|"$/g, "") : "";
	outlet(0, "set", (index + 1) + ": " + name);
}

function go(index) {
	var count = sceneCount();
	if (count < 1) return;
	if (index < 0) index = wrapAround ? count - 1 : 0;
	if (index >= count) index = wrapAround ? 0 : count - 1;

	var scene = new LiveAPI("live_set scenes " + index);
	scene.call("fire");

	// Re-select after firing so "Select Next Scene on Launch" can't drift us.
	var view = new LiveAPI("live_set view");
	view.set("selected_scene", "id", Number(scene.id));
	show(index);
}

function next() {
	var i = selectedIndex();
	go(i < 0 ? 0 : i + 1);
}

function prev() {
	var i = selectedIndex();
	go(i < 0 ? 0 : i - 1);
}

function launch() {
	var i = selectedIndex();
	go(i < 0 ? 0 : i);
}

function refresh() {
	show(selectedIndex());
}
