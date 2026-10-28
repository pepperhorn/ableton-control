// Resize jweb with the containing patcher window. Window geometry is saved by Max.
autowatch = 1;
var resizeTask = null;
function bang() {
    if (resizeTask) resizeTask.cancel();
    resizeTask = new Task(fit, this);
    resizeTask.interval = 200;
    resizeTask.repeat();
}
function fit() {
    var size = this.patcher.wind.size;
    var browser = this.patcher.getnamed('browser');
    if (browser && size) browser.rect = [0, 0, size[0], size[1]];
}
function notifydeleted() { if (resizeTask) resizeTask.cancel(); }
