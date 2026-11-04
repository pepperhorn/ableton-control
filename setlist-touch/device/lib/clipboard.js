'use strict';
const {spawn} = require('child_process');

// Feed data to stdin, never to a shell or command-line argument.
function copyText(text, {platform = process.platform, spawnProcess = spawn} = {}) {
  return new Promise((resolve, reject) => {
    const command = platform === 'win32' ? 'clip.exe' : platform === 'darwin' ? 'pbcopy' : null;
    if (!command) { reject(Error('Clipboard copying is unavailable on this platform')); return; }
    let child, timer, settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve();
    };
    try {
      child = spawnProcess(command, [], {shell:false, windowsHide:true, stdio:['pipe','ignore','ignore']});
      child.on('error', finish);
      child.once('close', (code, signal) => finish(code === 0 ? null : Error('Clipboard process failed (' + (signal || code) + ')')));
      child.stdin.on('error', finish);
      timer = setTimeout(() => { finish(Error('Clipboard process timed out')); child.kill(); }, 5000);
      child.stdin.end(text, 'utf8');
    } catch (error) { finish(error); }
  });
}
module.exports = {copyText};
