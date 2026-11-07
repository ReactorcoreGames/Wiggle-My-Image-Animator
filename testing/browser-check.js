// Browser smoke test: loads the app in headless Edge over file://, clicks through the main
// features, saves screenshots and prints any console errors.
// Usage (puppeteer-core is NOT installed in the project — install it in a scratch dir):
//   NODE_PATH=<scratch>/node_modules node testing/browser-check.js <output-dir>
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file:///' + ROOT.split(path.sep).join('/') + '/index.html';
const OUT = path.resolve(process.argv[2] || 'shots');
fs.mkdirSync(OUT, { recursive: true });

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
  const shot = async name => page.screenshot({ path: path.join(OUT, name + '.png') });

  await page.setViewport({ width: 1280, height: 860 });
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await wait(1200);
  await shot('desktop-sample');

  await page.click('#pathChk');
  await wait(700);
  await shot('desktop-path');

  const input = await page.$('#fileInput');
  for (const f of ['lemon_mascot_2.png', 'lemon_mascot_3.png', 'lemon_mascot_5.png']) {
    await input.uploadFile(path.join(ROOT, 'assets', f));
    await wait(1200);
    await shot('desktop-' + f.split(' ')[0].split('.')[0]);
  }

  // Breathe style + peek
  await page.click('.style-btn[data-id="breathe"]');
  await page.click('.swatch[data-id="clear"]');
  await wait(500);
  await shot('desktop-breathe-clear');
  const box = await (await page.$('#stageFrame')).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await wait(300);
  await shot('desktop-peek');
  await page.mouse.up();

  await page.click('#surpriseBtn');
  await page.click('#helpBtn');
  await wait(300);
  await shot('desktop-help');
  await page.keyboard.press('Escape');

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.reload();
  await wait(1200);
  await page.screenshot({ path: path.join(OUT, 'mobile-full.png'), fullPage: true });

  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.setViewport({ width: 1280, height: 860 });
  await wait(800);
  await shot('desktop-dark');

  console.log(errors.length ? errors.join('\n') : 'no console errors');
  await browser.close();
})();
