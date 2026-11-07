// Trailer maker: renders the YouTube trailer (and the 9:16 Shorts cut) from the real
// app in headless Edge, frame by frame. The page's requestAnimationFrame is replaced
// so app time only moves when trailer-layer.js says so; every frame is screenshotted
// and piped to ffmpeg, which adds the music (trimmed and faded) from trailer/.
// The plan and shot list are in trailer/trailer.md.
// Usage (same puppeteer-core setup as browser-check.js; ffmpeg on PATH):
//   NODE_PATH=<scratch>/node_modules node testing/trailer.js [--shorts] [--draft] [--out file.mp4]
//   NODE_PATH=<scratch>/node_modules node testing/trailer.js [--shorts] --stills 0.5,2,7.5 --out <dir>
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file:///' + ROOT.split(path.sep).join('/') + '/index.html';
const MUSIC = path.join(ROOT, 'trailer', 'Cafecito por la Manana - Cumbia Deli.mp3');
const LENGTH = 32;                // seconds; the track stops suiting the video after this
const FADE_FROM = 30.35;          // music fades over the last bar
const FPS = 30;

const args = process.argv.slice(2);
const flag = f => args.includes(f);
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const shorts = flag('--shorts');
const draft = flag('--draft');      // 480p preview
const stills = opt('--stills');
const out = path.resolve(opt('--out') || path.join(ROOT, 'trailer', `trailer${shorts ? '_shorts' : ''}${draft ? '_draft' : ''}.mp4`));

// 1536×864 CSS px ×1.25 = 1920×1080 (the same desktop layout as the screenshots);
// 432×768 ×2.5 = 1080×1920 (the app's phone layout).
const css = shorts ? { width: 432, height: 768, scale: 2.5 } : { width: 1536, height: 864, scale: 1.25 };
const dpr = css.scale * (draft ? 480 / 1080 : 1);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--allow-file-access-from-files', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.setViewport({ width: css.width, height: css.height, deviceScaleFactor: dpr });
  await page.evaluateOnNewDocument(() => {
    localStorage.clear();
    // Fake animation frames: trailer-layer.js pumps them with its own clock.
    let queue = [];
    window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
    window.cancelAnimationFrame = () => {};
    window.__pump = now => { const q = queue; queue = []; q.forEach(cb => cb(now)); };
    // Seeded Math.random, so Surprise me picks the same settings every render.
    let seed = 7;
    Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  });
  await page.goto(URL);
  await page.waitForFunction(() => typeof source !== 'undefined' && source);
  await page.addScriptTag({ path: path.join(__dirname, 'trailer-layer.js') });
  await page.evaluate(() => Trailer.setup());

  const shot = () => page.screenshot({ type: 'jpeg', quality: 93, optimizeForSpeed: true });
  if (stills) {
    fs.mkdirSync(out, { recursive: true });
    // Frames are rendered in order from 0 so state (drops, clicks, saves) matches the video.
    const want = stills.split(',').map(Number).sort((a, b) => a - b);
    for (let f = 0; f <= Math.round(want[want.length - 1] * FPS); f++) {
      const t = f / FPS;
      await page.evaluate(t => Trailer.frame(t), t);
      if (want.some(w => Math.round(w * FPS) === f)) fs.writeFileSync(path.join(out, `${shorts ? 's' : 'l'}_${t.toFixed(2)}.jpg`), await shot());
    }
  } else {
    const ff = spawn('ffmpeg', ['-v', 'error', '-y',
      '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-i', MUSIC,
      '-t', String(LENGTH),
      '-vf', `scale=trunc(iw/2)*2:trunc(ih/2)*2,fade=t=out:st=${LENGTH - 0.6}:d=0.6`,
      '-af', `afade=t=out:st=${FADE_FROM}:d=${LENGTH - FADE_FROM}`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', draft ? '23' : '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise(r => ff.on('close', r));
    const total = LENGTH * FPS;
    for (let f = 0; f < total; f++) {
      await page.evaluate(t => Trailer.frame(t), f / FPS);
      const buf = await shot();
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 60 === 0) process.stdout.write(`\r${f}/${total}`);
    }
    ff.stdin.end();
    await done;
    process.stdout.write('\n');
  }
  console.log(errors.length ? errors.join('\n') : 'no page errors');
  console.log('wrote', out);
  await browser.close();
})();
