// Export test: drives the Save buttons in headless Edge over file:// and collects the
// downloaded files, so they can be inspected with ffprobe afterwards.
// Usage (same puppeteer-core setup as browser-check.js):
//   NODE_PATH=<scratch>/node_modules node testing/export-check.js <output-dir>
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file:///' + ROOT.split(path.sep).join('/') + '/index.html';
const OUT = path.resolve(process.argv[2] || 'exports');
fs.mkdirSync(OUT, { recursive: true });

// Each case: settings to apply, the picture to load (null = mascot), and which button to press.
const CASES = [
  { name: 'gif-m-white', file: null, set: { size: 'm', bg: 'white', speed: 50 }, btn: 'gifBtn' },
  { name: 'gif-s-clear', file: 'lemon_mascot_3.png', set: { size: 's', bg: 'clear', style: 'circle' }, btn: 'gifBtn' },
  { name: 'gif-l-breathe', file: 'lemon_mascot_5.png', set: { size: 'l', bg: 'magenta', style: 'breathe', speed: 90 }, btn: 'gifBtn' },
  { name: 'video-m', file: null, set: { size: 'm', bg: 'green', speed: 70 }, btn: 'videoBtn' },
  { name: 'video-clear', file: 'lemon_mascot_4.png', set: { size: 's', bg: 'clear', speed: 20 }, btn: 'videoBtn' },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));

  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(URL);
  console.log('video type:', await page.evaluate(() => videoType()));

  for (const c of CASES) {
    const dir = path.join(OUT, c.name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const cdp = await page.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });

    await page.evaluate(s => localStorage.setItem('wiggle-settings-v1', JSON.stringify(s)), c.set);
    await page.reload();
    await wait(1000);
    if (c.file) {
      await (await page.$('#fileInput')).uploadFile(path.join(ROOT, 'assets', c.file));
      await wait(1000);
    }
    const t0 = Date.now();
    await page.click('#' + c.btn);
    await wait(300);
    await page.screenshot({ path: path.join(OUT, c.name + '-progress.png') });
    await page.waitForFunction(() => /Saved|Oops|Cancel|stopped/.test(document.getElementById('saveNote').textContent), { timeout: 120000 });
    const note = await page.$eval('#saveNote', el => el.textContent);
    await wait(1500);
    console.log(`${c.name}: ${((Date.now() - t0) / 1000).toFixed(1)}s, note="${note}", files=${fs.readdirSync(dir).join(', ')}`);
  }

  // Cancel mid-GIF should leave no file and say so.
  await page.evaluate(() => localStorage.setItem('wiggle-settings-v1', JSON.stringify({ size: 'l', speed: 0 })));
  await page.reload();
  await wait(1000);
  await page.click('#gifBtn');
  await wait(800);
  await page.click('#cancelBtn');
  await page.waitForFunction(() => document.getElementById('saveProgress').hidden, { timeout: 10000 });
  console.log('cancel note:', await page.$eval('#saveNote', el => el.textContent));

  console.log(errors.length ? errors.join('\n') : 'no console errors');
  await browser.close();
})();
