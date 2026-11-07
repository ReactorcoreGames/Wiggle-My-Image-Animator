// Promo image maker: drives the real app in headless Edge over file:// and writes the
// promo/ folder (16:9 screenshots, and the
// itch thumbnail (630×500) and cover (1280×720) posters built from wiggled mascot frames)
// and the gifs/ folder (demo GIFs made by the app's own Save button).
// Usage (same puppeteer-core setup as browser-check.js; ffmpeg on PATH turns PNGs into JPGs):
//   NODE_PATH=<scratch>/node_modules node testing/promo-shots.js [promo-dir, default promo/] [gif-dir, default gifs/]
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file:///' + ROOT.split(path.sep).join('/') + '/index.html';
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'promo'));
const GIFS = path.resolve(process.argv[3] || path.join(ROOT, 'gifs'));   // demo GIFs (kept out of the release zip)
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(GIFS, { recursive: true });
const asset = f => path.join(ROOT, 'assets', f);
const wait = ms => new Promise(r => setTimeout(r, ms));

// Screenshots: 1536×864 CSS px at 1.25× = 1920×1080 (tall enough to show the Save buttons).
const SHOTS = [
  { name: 'screenshot_1', file: 'lemon_mascot_1.png', theme: 'light', set: { style: 'infinity', wiggle: 55, wander: 60, bg: 'white', fit: true }, path: true },
  { name: 'screenshot_2', file: 'lemon_mascot_6.png', theme: 'dark', set: { style: 'circle', wiggle: 70, wander: 45, bg: 'green', fit: true } },
  { name: 'screenshot_3', file: 'lemon_mascot_3.png', theme: 'light', set: { style: 'breathe', wiggle: 80, wander: 50, bg: 'custom', customBg: '#bfe6ff', fit: true } },
  { name: 'screenshot_4', file: 'lemon_mascot_5.png', theme: 'dark', set: { style: 'eight', wiggle: 60, wander: 55, bg: 'magenta', fit: true }, help: true },
];

// Demo GIFs: default sliders, every style, a pastel background each. Saved as demo_<style name>.gif.
const DEMOS = [
  { style: 'infinity', name: 'infinity',  file: 'lemon_mascot_1.png', bg: '#ffd6e0' },
  { style: 'eight',    name: 'figure-8',  file: 'lemon_mascot_2.png', bg: '#d6ecff' },
  { style: 'circle',   name: 'circle',    file: 'lemon_mascot_6.png', bg: '#d9f7d0' },
  { style: 'side',     name: 'side-side', file: 'lemon_mascot_1.png', bg: '#fff1b8' },
  { style: 'updown',   name: 'up-down',   file: 'lemon_mascot_2.png', bg: '#e6dcff' },
  { style: 'diag1',    name: 'downhill',  file: 'lemon_mascot_6.png', bg: '#ffe0c7' },
  { style: 'diag2',    name: 'uphill',    file: 'lemon_mascot_1.png', bg: '#cdf3ee' },
  { style: 'breathe',  name: 'breathe',   file: 'lemon_mascot_6.png', bg: '#f6d8f0' },
];

// Wiggled frames (see-through PNG data URIs) for the posters, rendered at the
// frame's own shape with the long side = size: [{ src, w, h }]. trim crops each
// frame to its visible pixels (for the sticker cards).
async function frames(page, file, set, ts, size, trim = false) {
  await page.evaluate(s => localStorage.setItem('wiggle-settings-v1', JSON.stringify(s)), set);
  await page.reload();
  await wait(800);
  await (await page.$('#fileInput')).uploadFile(asset(file));
  await wait(1000);
  return page.evaluate((ts, size, trim) => {
    const k = size / Math.max(frameW, frameH);
    const w = Math.round(frameW * k), h = Math.round(frameH * k);
    const r = makeRenderer(settings, w, h, null, true);
    const grab = () => {
      if (!trim) return { src: r.canvas.toDataURL('image/png'), w, h };
      const a = r.ctx.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (a[(y * w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
      const c = document.createElement('canvas');
      c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
      c.getContext('2d').drawImage(r.canvas, -x0, -y0);
      return { src: c.toDataURL('image/png'), w: c.width, h: c.height };
    };
    const out = ts.map(t => { r.draw(t); return grab(); });
    r.destroy();
    return out;
  }, ts, size, trim);
}

// Presses Download GIF and moves the saved file to dest.
async function saveGif(page, dl, dest) {
  await page.click('#gifBtn');
  await page.waitForFunction(() => /Saved|Oops/.test(document.getElementById('saveNote').textContent), { timeout: 120000 });
  await wait(1500);
  const gif = fs.readdirSync(dl).find(f => f.endsWith('.gif'));
  fs.renameSync(path.join(dl, gif), dest);
}

function toJpg(png, jpg) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '3', jpg]);
  fs.unlinkSync(png);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(URL);

  // --- Screenshots
  await page.setViewport({ width: 1536, height: 864, deviceScaleFactor: 1.25 });
  for (const s of SHOTS) {
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: s.theme }]);
    await page.evaluate(set => localStorage.setItem('wiggle-settings-v1', JSON.stringify(set)), { size: 'm', speed: 50, ...s.set });
    await page.reload();
    await wait(800);
    await (await page.$('#fileInput')).uploadFile(asset(s.file));
    await wait(1400);
    if (s.path) await page.click('#pathChk');
    if (s.help) await page.click('#helpBtn');
    await wait(500);
    const png = path.join(OUT, s.name + '.png');
    await page.screenshot({ path: png });
    toJpg(png, path.join(OUT, s.name + '.jpg'));
    if (s.path) await page.click('#pathChk');
  }

  // --- Demo GIFs, made by the app's own Download GIF button
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  const cdp = await page.createCDPSession();
  const dl = path.join(OUT, '_download');
  fs.rmSync(dl, { recursive: true, force: true });
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
  const demos = [{ file: 'lemon_mascot_1.png', name: 'demo.gif',
    set: { style: 'infinity', wiggle: 55, wander: 60, speed: 55, bg: 'custom', customBg: '#fff3a8', fit: true, size: 's' } }];
  for (const d of DEMOS) {
    demos.push({ file: d.file, name: `demo_${d.name}.gif`, set: { style: d.style, bg: 'custom', customBg: d.bg, fit: true, size: 's' } });
  }
  for (const d of demos) {
    await page.evaluate(s => localStorage.setItem('wiggle-settings-v1', JSON.stringify(s)), d.set);
    await page.reload();
    await wait(800);
    await (await page.$('#fileInput')).uploadFile(asset(d.file));
    await wait(1000);
    await saveGif(page, dl, path.join(GIFS, d.name));
  }
  fs.rmSync(dl, { recursive: true, force: true });

  // --- Poster art
  const hero = await frames(page, 'lemon_mascot_1.png', { style: 'infinity', wiggle: 50, wander: 55, fit: true, bg: 'clear' }, [0.1, 0.3, 0.5], 720);
  const stickers = [];
  for (const [file, style, wiggle, t] of [['lemon_mascot_5.png', 'circle', 50, 0.2], ['lemon_mascot_6.png', 'eight', 50, 0.6], ['lemon_mascot_3.png', 'breathe', 25, 0.25], ['lemon_mascot_4.png', 'updown', 25, 0.3]]) {
    stickers.push((await frames(page, file, { style, wiggle, wander: 55, fit: true, bg: 'clear' }, [t], 360, true))[0]);
  }

  const poster = fs.readFileSync(path.join(__dirname, 'promo-poster.html'), 'utf8');
  for (const p of [{ name: 'cover', w: 1280, h: 720 }, { name: 'itch_thumbnail', w: 630, h: 500 }]) {
    await page.setViewport({ width: p.w, height: p.h, deviceScaleFactor: 1 });
    await page.setContent(poster, { waitUntil: 'load' });
    await page.evaluate((layout, hero, stickers) => window.build(layout, hero, stickers), p.name, hero, stickers);
    await page.evaluate(() => document.fonts.ready);
    await wait(300);
    const png = path.join(OUT, p.name + '.png');
    await page.screenshot({ path: png });
    toJpg(png, path.join(OUT, p.name + '.jpg'));
  }

  console.log(errors.length ? errors.join('\n') : 'no page errors');
  console.log('wrote', fs.readdirSync(OUT).join(', '));
  await browser.close();
})();
