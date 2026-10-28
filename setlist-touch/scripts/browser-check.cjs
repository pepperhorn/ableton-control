/* Optional integration check. Point PLAYWRIGHT_MODULE at an external Playwright
 * install; this is a development tool and adds no device runtime dependency. */
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('assert/strict');
const path = require('path');
const fs = require('fs');
const {createApp} = require('../device/lib/app');
const {createFakeBridge} = require('../device/lib/fake-bridge');
const fixture = require('../device/lib/fixture-rise.json');
const artifactDir = process.env.ARTIFACT_DIR || '/tmp/setlist-touch-browser';
async function run() {
  fs.mkdirSync(artifactDir, {recursive:true});
  const bridge = createFakeBridge(fixture);
  let app = createApp({bridge});
  const port = await app.listen(0), base = `http://127.0.0.1:${port}`;
  const stop = bridge.simulate({scene:23, bpm:100});
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || undefined, args:['--no-sandbox']});
  let launches = 0;
  bridge.on('fire', () => launches++);
  try {
    const page = await browser.newPage({viewport:{width:1280,height:800}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(() => document.querySelector('.song-title').textContent === 'RISE >>');
    await page.waitForFunction(() => !document.querySelector('.is-playing .tile-bars').hidden);
    assert.equal(await page.locator('.scene-row').count(), 11);
    const geometry = await page.locator('.scene-list').evaluate(el => ({client:el.clientHeight,scroll:el.scrollHeight}));
    assert.equal(geometry.client, geometry.scroll);
    assert.match(await page.locator('.is-playing .tile-bars').textContent(), /\d+ \/ 32/);
    const firstFill = await page.locator('.is-playing .tile-progress').evaluate(el => el.style.width);
    await page.waitForFunction(previous => document.querySelector('.is-playing .tile-progress').style.width !== previous, firstFill);
    await page.screenshot({path:path.join(artifactDir,'setlist-touch-desktop.png')});
    await page.locator('.setlist-item').filter({hasText:'HOW DEEP'}).click();
    assert.equal(await page.locator('.song-title').textContent(), 'HOW DEEP >>');
    assert.equal(await page.locator('.now-playing-banner').textContent(), 'Now playing: RISE >>');
    await page.locator('.filter-pill').filter({hasText:'DINNER'}).click();
    assert.equal(await page.locator('.setlist-item').count(), 3);
    await page.locator('.sidebar-toggle').click();
    assert.equal(await page.locator('.setlist-sidebar').isVisible(), false);
    const row = page.locator('.scene-row').first(), rect = await row.boundingBox();
    await page.mouse.move(rect.x + 30, rect.y + 20);
    await page.mouse.down(); await page.mouse.move(rect.x + 30, rect.y + 40, {steps:5}); await page.mouse.up();
    assert.equal(launches, 0);
    await page.evaluate(() => {
      const row = document.querySelector('.scene-row'), r = row.getBoundingClientRect();
      for (const [type,id] of [['pointerdown',101],['pointerdown',102],['pointerup',101],['pointerup',102]]) {
        row.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,button:0,clientX:r.x+20,clientY:r.y+20}));
      }
    });
    assert.equal(launches, 0);
    await page.locator('.lock-toggle').click(); await row.click();
    assert.equal(launches, 0);
    await page.locator('.lock-toggle').click();
    const firing = page.waitForResponse(r => r.url().endsWith('/api/fire'));
    await row.click(); assert.equal((await firing).status(),204); assert.equal(launches,1);
    // Reject a stale rendered row without launching anything.
    await page.route('**/api/fire', route => route.fulfill({status:409,body:'Set changed'}));
    await row.click(); await page.locator('.scene-row.is-stale').waitFor(); assert.equal(launches,1);
    await page.unroute('**/api/fire');
    // A full replacement snapshot must preserve browsing by title/occurrence.
    bridge.emit('scenes',[{index:0,name:'* New',color:0,loopBeats:null,beatsPerBar:4}, ...fixture.map(s => ({...s,index:s.index+1}))]);
    await page.waitForFunction(() => document.querySelector('.scene-row').dataset.sceneIndex === '11');
    assert.equal(await page.locator('.song-title').textContent(),'HOW DEEP >>');
    bridge.emit('scenes',fixture);
    await page.waitForFunction(() => document.querySelector('.scene-row').dataset.sceneIndex === '10');
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(artifactDir,'setlist-touch-phone.png')});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.goto(base + '/#settings');
    await page.locator('.settings-panel').waitFor();
    await page.waitForFunction(() => document.querySelector('[name=username]').value === 'band');
    assert.equal(await page.locator('.touch-test-link').getAttribute('href'),'/touch-test.html');
    assert.equal(await page.locator('.setlist-main').isVisible(),false);
    await page.locator('.touch-test-link').click();
    await page.locator('.touch-target').click();
    await page.locator('.touch-target.is-hit').waitFor();
    await page.locator('.spike-back').click();
    await page.waitForFunction(() => document.querySelector('.song-title').textContent === 'RISE >>');
    // Keep the page loaded while the server stops, then reconnect to the same port.
    await app.close();
    await page.locator('.connection-bar').waitFor();
    const reconnectBefore = launches;
    await page.locator('.scene-row').first().click(); assert.equal(launches,reconnectBefore);
    app = createApp({bridge}); await app.listen(port); bridge.snapshot();
    await page.waitForFunction(() => document.querySelector('.connection-bar').hidden, {timeout:15000});
    assert.equal(await page.locator('.song-title').textContent(),'RISE >>');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({result:'PASS',desktop:geometry,riseRows:11,dragLaunches:0,multitouchLaunches:0,lockedLaunches:0,cleanTapLaunches:1,stale409:true,settings:true,touchDiagnostic:true,reconnect:true,phoneOverflow:false,pageErrors:errors,artifactDir},null,2));
  } finally { stop(); await app.close(); await browser.close(); }
}
run().catch(error => {console.error(error);process.exitCode=1;});
