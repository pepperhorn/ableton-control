// Resize jweb with the containing patcher window. Window geometry is saved by Max.
autowatch = 1;
var resizeTask = null, lastSize = '';
function bang() {
    if (resizeTask) resizeTask.cancel();
    if (!this.patcher.wind.visible) return;
    resizeTask = new Task(fit, this);
    resizeTask.interval = 200;
    resizeTask.repeat();
}
function showwindow() {
    this.patcher.wind.visible = 1;
    lastSize = '';
    bang();
    fit();
}
function fit() {
    if (!this.patcher.wind.visible) {
        if (resizeTask) resizeTask.cancel();
        return;
    }
    var size = this.patcher.wind.size;
    if (String(size) === lastSize) return;
    var browser = this.patcher.getnamed('browser');
    if (browser && size) {
        browser.rect = [0, 0, size[0], size[1]];
        browser.setboxattr('presentation_rect', [0, 0, size[0], size[1]]);
        lastSize = String(size);
    }
}
function notifydeleted() { if (resizeTask) resizeTask.cancel(); }
