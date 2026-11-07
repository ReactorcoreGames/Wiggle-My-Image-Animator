'use strict';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------
const STAGE_LONG = 720;              // long side of the working frame, in px
const IMAGE_FILL = 0.8;              // picture fills 80% of the frame; the rest is room to wiggle
const MIN_ASPECT = 0.5;              // frame shape is clamped between 1:2 ...
const MAX_ASPECT = 2;                // ... and 2:1; more extreme pictures get letterboxed
const SOURCE_MAX = 1440;             // big uploads are shrunk to this long side on load
const STORE_KEY = 'wiggle-settings-v1';
const GIF_DELAY_CS = 4;              // GIF frame delay in 1/100 s (25 fps); GIF delays only come in whole hundredths
const GIF_PALETTE_SAMPLES = 4;       // frames looked at to pick the GIF's 256 colours
const VIDEO_FPS = 30;
const VIDEO_MIN_SECONDS = 3;         // short loops repeat until the video is at least this long
const VIDEO_BITS_PER_PIXEL = 0.3;    // per frame; ~3.5 Mbps at Large
const FIT_MARGIN = 0.02;             // "Stay in frame" keeps this much of the frame's short side clear
const FIT_MAX_ZOOM = 3;              // ... and never zooms in further than this
const FIT_GRID = 64;                 // picture outline is traced on a grid this many cells across
const FIT_STEPS = 64;                // loop positions checked when working out the zoom

const SIZES = [
  { id: 's', name: 'Small',  long: 320 },
  { id: 'm', name: 'Medium', long: 480 },
  { id: 'l', name: 'Large',  long: 720 },
];

// First one the browser can record wins. Most now do MP4; older Chrome/Firefox fall back to WebM.
const VIDEO_TYPES = [
  'video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4',
  'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm',
];

const BACKGROUNDS = [
  { id: 'clear', color: null,      label: 'See-through' },
  { id: 'white', color: '#ffffff', label: 'White' },
  { id: 'black', color: '#000000', label: 'Black' },
  { id: 'green', color: '#00ff00', label: 'Green screen' },
  { id: 'magenta', color: '#ff00ff', label: 'Magenta' },
  { id: 'custom', label: 'Pick any colour' },   // colour comes from settings.customBg
];

// Every path is a smooth closed loop. path(a) takes an angle 0..2π and returns
// {u, v} in -1..1, which gets stretched over the picture by the Wander amount.
// Screen y points down, so +v is lower on the picture.
const TAU = Math.PI * 2;
const STYLES = [
  { id: 'infinity', name: 'Infinity',  path: a => ({ u: -Math.cos(a), v: 0.6 * Math.sin(2 * a) }) },
  { id: 'eight',    name: 'Figure 8',  path: a => ({ u: 0.6 * Math.sin(2 * a), v: Math.cos(a) }) },
  { id: 'circle',   name: 'Circle',    path: a => ({ u: Math.cos(a), v: Math.sin(a) }), round: true },
  { id: 'side',     name: 'Side-side', path: a => ({ u: -Math.cos(a), v: 0 }) },
  { id: 'updown',   name: 'Up-down',   path: a => ({ u: 0, v: -Math.cos(a) }) },
  { id: 'diag1',    name: 'Downhill',  path: a => ({ u: -Math.cos(a), v: -Math.cos(a) }) },
  { id: 'diag2',    name: 'Uphill',    path: a => ({ u: -Math.cos(a), v: Math.cos(a) }) },
  { id: 'breathe',  name: 'Breathe',   bulge: true },
];

const DEFAULTS = { style: 'infinity', wiggle: 40, wander: 55, speed: 50, bg: 'white', customBg: '#ffe14d', reverse: false, fit: false, size: 'm', theme: null };  // theme null = follow the device

// ---------------------------------------------------------------------------
// Slider value -> effect value, plus friendly words for the UI
// ---------------------------------------------------------------------------
const swirlAngle   = w => 0.15 + (w / 100) * 2.6;            // radians of twist at the swirl centre
const bulgeAmount  = w => 0.12 + (w / 100) * 0.83;           // glfx bulgePinch strength, max 1
const wanderAmount = w => 0.05 + (w / 100) * 0.95;           // 1 = path reaches the picture's edges
const loopSeconds  = s => 6 * Math.pow(0.75 / 6, s / 100);   // 6s (slow) .. 0.75s (fast)

function wiggleWord(w) {
  return w < 15 ? 'Gentle' : w < 40 ? 'Wobbly' : w < 70 ? 'Twisty' : w < 90 ? 'Bonkers' : 'Unhinged';
}
function wanderWord(w) {
  return w < 20 ? 'Stays put' : w < 50 ? 'Strolls' : w < 80 ? 'Roams' : 'Everywhere';
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const els = {
  stage: $('stage'), frame: $('stageFrame'), overlay: $('overlay'), msg: $('stageMsg'),
  pickBtn: $('pickBtn'), fileInput: $('fileInput'), surpriseBtn: $('surpriseBtn'),
  styles: $('styles'), swatches: $('swatches'),
  wiggle: $('wiggle'), wander: $('wander'), speed: $('speed'),
  wiggleOut: $('wiggleOut'), wanderOut: $('wanderOut'), speedOut: $('speedOut'),
  reverseChk: $('reverseChk'), pathChk: $('pathChk'), fitChk: $('fitChk'),
  themeBtn: $('themeBtn'), helpBtn: $('helpBtn'), helpModal: $('helpModal'), helpClose: $('helpClose'),
  title: $('title'),
  sizes: $('sizes'), saveBtns: $('saveBtns'), gifBtn: $('gifBtn'), videoBtn: $('videoBtn'), shareBtn: $('shareBtn'),
  saveProgress: $('saveProgress'), saveBar: $('saveBar'), saveFill: $('saveFill'), saveLabel: $('saveLabel'),
  cancelBtn: $('cancelBtn'), saveNote: $('saveNote'),
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const settings = { ...DEFAULTS, ...loadSettings() };
let source = null;        // canvas holding the (possibly shrunk) uploaded picture
let sourceName = 'wiggle';
let frameW = 0, frameH = 0, imgRect = null;
let fxCanvas = null, texture = null, textureZoom = 1;
let outline = [];         // points around the picture's visible (non-see-through) edge, in frame px
let phase = 0, lastTime = 0, peeking = false;
let sourceId = 0;         // bumps on every new picture, so a stale GIF is never shared
let exportFx = null;      // second glfx canvas used for saving, sized to the export
let job = null;           // the save in progress: { cancelled, reason }
let lastGif = null;       // { key, file } — the most recent GIF, ready to share

// ---------------------------------------------------------------------------
// Settings persistence (a per-browser convenience only)
// ---------------------------------------------------------------------------
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function saveSettings() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch {}
}

// ---------------------------------------------------------------------------
// Frame maths — shared by the live preview and the exporters
// ---------------------------------------------------------------------------
function styleById(id) { return STYLES.find(s => s.id === id) || STYLES[0]; }

// The picture's spot in the frame, shrunk or grown about the centre by zoom z.
function zoomRect(z) {
  const w = imgRect.w * z, h = imgRect.h * z;
  return { x: (frameW - w) / 2, y: (frameH - h) / 2, w, h };
}

// Returns everything needed to draw the effect at loop position t (0..1).
// z is the "Stay in frame" zoom. It scales the picture, the path and the swirl
// radius alike, so the result is exactly the unzoomed wiggle, zoomed.
function effectAt(t, s = settings, W = frameW, H = frameH, z = fitZoom(s)) {
  const style = styleById(s.style);
  if (s.reverse) t = 1 - t;
  const a = t * TAU;
  const cx = W / 2, cy = H / 2;
  const scale = W / frameW * z;                   // lets exporters render at other sizes
  const halfW = imgRect.w / 2 * scale, halfH = imgRect.h / 2 * scale;
  const reach = wanderAmount(s.wander);

  if (style.bulge) {
    const radius = Math.max(halfW, halfH) * (0.45 + reach * 0.75);
    return { kind: 'bulge', x: cx, y: cy, radius, strength: bulgeAmount(s.wiggle) * Math.sin(a) };
  }
  let ax = halfW * reach, ay = halfH * reach;
  if (style.round) ax = ay = Math.min(ax, ay);
  const p = style.path(a);
  return { kind: 'swirl', x: cx + p.u * ax, y: cy + p.v * ay, radius: Math.max(W, H) * z, angle: swirlAngle(s.wiggle) };
}

// Where the effect moves a picture point (x, y) to. glfx works backwards (each
// output pixel looks up a source pixel); both effects keep a point's direction
// from the centre, so going forwards is easy. Swirl keeps the distance too and
// only rotates, the other way. Bulge changes the distance, found by bisection.
function movePoint(e, x, y) {
  const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
  if (d >= e.radius || d === 0) return { x, y };
  if (e.kind === 'swirl') {
    const p = (e.radius - d) / e.radius, th = -p * p * e.angle;
    const c = Math.cos(th), s = Math.sin(th);
    return { x: e.x + dx * c - dy * s, y: e.y + dx * s + dy * c };
  }
  const R = e.radius, k = e.strength;
  const lookup = o => {                           // output distance -> source distance (the shader)
    const p = o / R;
    if (k > 0) { const q = Math.min(1, p * p); return o * (1 - k * 0.75 + k * 0.75 * q * q * (3 - 2 * q)); }
    return o * (p + (1 - p) * Math.pow(p, k * 0.75));
  };
  let lo = 0, hi = R;
  for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; lookup(mid) < d ? lo = mid : hi = mid; }
  const f = (lo + hi) / 2 / d;
  return { x: e.x + dx * f, y: e.y + dy * f };
}

// "Stay in frame": one zoom for the whole loop, so the picture's furthest
// reach over the loop just touches the frame (minus a margin). 1 when off.
let fitCache = { key: '', zoom: 1 };
function fitZoom(s) {
  if (!s.fit || !outline.length) return 1;
  const key = [sourceId, s.style, s.wiggle, s.wander].join();
  if (fitCache.key === key) return fitCache.zoom;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < FIT_STEPS; i++) {
    const e = effectAt(i / FIT_STEPS, s, frameW, frameH, 1);
    for (const pt of outline) {
      const q = movePoint(e, pt.x, pt.y);
      if (q.x < x0) x0 = q.x;
      if (q.x > x1) x1 = q.x;
      if (q.y < y0) y0 = q.y;
      if (q.y > y1) y1 = q.y;
    }
  }
  // Zooming about the centre scales each side's distance from it.
  const cx = frameW / 2, cy = frameH / 2, m = Math.min(frameW, frameH) * FIT_MARGIN;
  let zoom = FIT_MAX_ZOOM;
  if (x0 < cx) zoom = Math.min(zoom, (cx - m) / (cx - x0));
  if (x1 > cx) zoom = Math.min(zoom, (cx - m) / (x1 - cx));
  if (y0 < cy) zoom = Math.min(zoom, (cy - m) / (cy - y0));
  if (y1 > cy) zoom = Math.min(zoom, (cy - m) / (y1 - cy));
  fitCache = { key, zoom };
  return zoom;
}

// Traces the edge of the picture's visible part on a coarse grid. Corners of
// edge cells err on the outside, so the fit never cuts anything off.
function traceOutline() {
  const k = FIT_GRID / Math.max(source.width, source.height);
  const gw = Math.max(1, Math.round(source.width * k)), gh = Math.max(1, Math.round(source.height * k));
  const c = document.createElement('canvas');
  c.width = gw; c.height = gh;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, gw, gh);
  const alpha = ctx.getImageData(0, 0, gw, gh).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh && alpha[(y * gw + x) * 4 + 3] > 16;
  const cw = imgRect.w / gw, ch = imgRect.h / gh;
  const corners = new Set();   // neighbouring edge cells share corners; keep each once
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    if (!solid(x, y) || (solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1))) continue;
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) corners.add((y + oy) * (gw + 1) + x + ox);
  }
  outline = [...corners].map(i => ({ x: imgRect.x + (i % (gw + 1)) * cw, y: imgRect.y + Math.floor(i / (gw + 1)) * ch }));
}

function applyEffect(chain, e) {
  return e.kind === 'bulge'
    ? chain.bulgePinch(e.x, e.y, e.radius, e.strength)
    : chain.swirl(e.x, e.y, e.radius, e.angle);
}

// ---------------------------------------------------------------------------
// Loading pictures
// ---------------------------------------------------------------------------
function showMessage(text) {
  els.msg.textContent = text;
  els.msg.hidden = !text;
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// iPhone photos are often HEIC, which most browsers can't open. Windows may give them no type at all.
const isHeic = file => /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '');

async function loadFile(file) {
  if (!file || (file.type && !file.type.startsWith('image/'))) {
    flashMessage("That doesn't look like a picture. Try a JPG, PNG, GIF or WebP.");
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    // Animated GIFs and WebPs just use their first frame. Phone photos come out
    // the right way up because browsers apply the EXIF rotation when decoding.
    const img = await loadImageFromUrl(url);
    setSource(img, file.name || 'pasted');
  } catch {
    flashMessage(isHeic(file)
      ? "This browser can't open HEIC photos. Save it as a JPG first (or screenshot it), then try again."
      : "Hmm, couldn't open that one. Try a JPG, PNG, GIF or WebP.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

let flashTimer = 0;
function flashMessage(text) {
  showMessage(text);
  clearTimeout(flashTimer);
  if (source) flashTimer = setTimeout(() => showMessage(''), 3500);
}

function setSource(img, name) {
  if (job) job.cancelled = true;        // a save in progress belongs to the old picture
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) { flashMessage("Hmm, that picture seems to be empty."); return; }
  const shrink = Math.min(1, SOURCE_MAX / Math.max(iw, ih));
  source = document.createElement('canvas');
  source.width = Math.round(iw * shrink);
  source.height = Math.round(ih * shrink);
  const ctx = source.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, source.width, source.height);
  sourceName = name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_') || 'wiggle';
  sourceId++;

  // Frame shape follows the picture, within limits. Even sizes keep video encoders happy.
  const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, source.width / source.height));
  if (aspect >= 1) { frameW = STAGE_LONG; frameH = STAGE_LONG / aspect; }
  else             { frameH = STAGE_LONG; frameW = STAGE_LONG * aspect; }
  frameW = Math.round(frameW / 2) * 2;
  frameH = Math.round(frameH / 2) * 2;
  const fit = Math.min(frameW * IMAGE_FILL / source.width, frameH * IMAGE_FILL / source.height);
  const w = source.width * fit, h = source.height * fit;
  imgRect = { x: (frameW - w) / 2, y: (frameH - h) / 2, w, h };
  traceOutline();

  els.stage.style.setProperty('--frame-ar', `${frameW + 24} / ${frameH + 24}`);
  els.overlay.width = frameW;
  els.overlay.height = frameH;
  rebuildTexture();
  fitFrame();
  syncUI();
  showMessage('');
  els.frame.hidden = false;
}

// Draws the picture onto a transparent frame and uploads it to the GPU.
// Done only when the picture changes, never per frame. The background colour is
// laid *under* the effect instead (glfx fades out pixels it pulls from beyond
// the frame edge, so a baked-in background would get see-through holes).
function composeFrame(W = frameW, H = frameH, z = 1) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const k = W / frameW;
  const r = zoomRect(z);
  const upscale = r.w * k / source.width;
  // Small pictures (pixel art, emoji, icons) stay crisp instead of going blurry.
  ctx.imageSmoothingEnabled = upscale < 2;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, r.x * k, r.y * k, r.w * k, r.h * k);
  return c;
}

function bgColor(s = settings) {
  if (s.bg === 'custom') return s.customBg;
  const bg = BACKGROUNDS.find(b => b.id === s.bg);
  return bg ? bg.color : null;
}

function applyTheme() {
  const dark = settings.theme ? settings.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  els.themeBtn.textContent = dark ? '☀️' : '🌙';
  els.themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}

function applyBackground() {
  els.frame.style.backgroundColor = bgColor() || '';
  els.frame.style.backgroundImage = bgColor() ? 'none' : '';
}

function rebuildTexture() {
  if (!source || !fxCanvas) return;
  if (texture) texture.destroy();
  textureZoom = fitZoom(settings);
  texture = fxCanvas.texture(composeFrame(frameW, frameH, textureZoom));
}

// Size the on-screen frame to fit the stage while keeping its shape.
function fitFrame() {
  if (!frameW) return;
  const box = els.stage.getBoundingClientRect();
  const k = Math.min((box.width - 24) / frameW, (box.height - 24) / frameH);
  const w = Math.max(1, Math.floor(frameW * k)), h = Math.max(1, Math.floor(frameH * k));
  els.frame.style.width = w + 'px';
  els.frame.style.height = h + 'px';
  fxCanvas.style.width = w + 'px';
  fxCanvas.style.height = h + 'px';
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
function tick(now) {
  requestAnimationFrame(tick);
  const dt = lastTime ? Math.min(0.1, (now - lastTime) / 1000) : 0;
  lastTime = now;
  if (!texture || !els.helpModal.hidden) return;          // nothing to draw, or hidden behind help
  if (fitZoom(settings) !== textureZoom) rebuildTexture();   // "Stay in frame" zoom changed
  phase = (phase + dt / loopSeconds(settings.speed)) % 1;

  const chain = fxCanvas.draw(texture);
  const e = effectAt(phase);
  (peeking ? chain : applyEffect(chain, e)).update();
  drawOverlay(e);
}

function drawOverlay(current) {
  const ctx = els.overlay.getContext('2d');
  ctx.clearRect(0, 0, frameW, frameH);
  if (!els.pathChk.checked || peeking) return;
  const lw = Math.max(2, frameW / 180);
  ctx.save();
  ctx.lineWidth = lw * 1.6;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.setLineDash([lw * 2, lw * 2.5]);
  ctx.strokeStyle = 'rgba(46, 125, 50, .85)';
  ctx.beginPath();
  if (current.kind === 'bulge') {
    ctx.arc(current.x, current.y, current.radius, 0, TAU);
  } else {
    for (let i = 0; i <= 96; i++) {
      const p = effectAt(i / 96);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  const r = current.kind === 'bulge' ? lw * 3 + Math.abs(current.strength) * lw * 5 : lw * 3 + current.angle * lw * 2;
  ctx.fillStyle = '#ff8a3d';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(current.x, current.y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Saving: GIF, video and sharing
// ---------------------------------------------------------------------------
const nextTask = () => new Promise(r => setTimeout(r, 0));

function exportSize(s) {
  const long = (SIZES.find(z => z.id === s.size) || SIZES[1]).long;
  const k = long / Math.max(frameW, frameH);
  return { W: Math.round(frameW * k / 2) * 2, H: Math.round(frameH * k / 2) * 2 };
}

// Whole frames only, so the GIF's loop is the slider's loop to within 1/50 s.
function gifFrameCount(s) {
  return Math.max(6, Math.round(loopSeconds(s.speed) * 100 / GIF_DELAY_CS));
}

// Everything that changes the saved file. If this matches, the last GIF can be shared as-is.
function exportKey(s) {
  return JSON.stringify([sourceId, s.style, s.wiggle, s.wander, s.speed, s.bg, s.customBg, s.reverse, s.fit, s.size]);
}

function videoType() {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
  return VIDEO_TYPES.find(t => MediaRecorder.isTypeSupported(t)) || null;
}

const canShareFiles = (() => {
  try {
    return !!navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.gif', { type: 'image/gif' })] });
  } catch { return false; }
})();

// Off-screen renderer for the current picture at W×H. draw(t) paints loop
// position t onto a 2D canvas: background first, the glfx output on top,
// copied in the same task as update() (the glfx canvas isn't preserved).
function makeRenderer(s, W, H, bg, forReading) {
  if (!exportFx) exportFx = fx.canvas();
  const tex = exportFx.texture(composeFrame(W, H, fitZoom(s)));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: forReading });
  return {
    canvas, ctx,
    draw(t) {
      applyEffect(exportFx.draw(tex), effectAt(t, s, W, H)).update();
      ctx.clearRect(0, 0, W, H);
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
      ctx.drawImage(exportFx, 0, 0);
    },
    destroy() { tex.destroy(); },
  };
}

async function makeGif(s, onProgress) {
  const { GIFEncoder, quantize, applyPalette } = window.gifenc;
  const { W, H } = exportSize(s);
  const bg = bgColor(s);
  const frames = gifFrameCount(s);
  const r = makeRenderer(s, W, H, bg, true);
  const gif = GIFEncoder();
  const grab = t => { r.draw(t); return r.ctx.getImageData(0, 0, W, H).data; };
  try {
    // One palette for the whole GIF, picked from a few frames spread over the loop.
    // Much faster than a palette per frame (photos took over a second each), and
    // flat areas don't shimmer. rgb444 bins are 10× quicker than the default and look the same.
    const sample = new Uint8ClampedArray(W * H * 4 * GIF_PALETTE_SAMPLES);
    for (let k = 0; k < GIF_PALETTE_SAMPLES; k++) sample.set(grab(k / GIF_PALETTE_SAMPLES), k * W * H * 4);
    // See-through: one palette slot is fully transparent, and each frame replaces the last (dispose 2).
    const format = bg ? 'rgb444' : 'rgba4444';
    const palette = quantize(sample, 256, bg ? { format } : { format, oneBitAlpha: true });
    const transparentIndex = palette.findIndex(p => p[3] === 0);
    const opts = bg ? {} : { transparent: transparentIndex >= 0, transparentIndex, dispose: 2 };
    await nextTask();

    for (let i = 0; i < frames; i++) {
      if (job.cancelled) return null;
      const index = applyPalette(grab(i / frames), palette, bg ? 'rgb565' : 'rgba4444');
      gif.writeFrame(index, W, H, { ...opts, palette: i ? null : palette, delay: GIF_DELAY_CS * 10, repeat: 0 });
      onProgress((i + 1) / frames);
      await nextTask();
    }
  } finally {
    r.destroy();
  }
  gif.finish();
  return new Blob([gif.bytesView()], { type: 'image/gif' });
}

// Plays whole loops through in real time while MediaRecorder captures the canvas.
// Videos can't be see-through, so a see-through background becomes white.
async function makeVideo(s, onProgress) {
  const type = videoType();
  const { W, H } = exportSize(s);
  const loopMs = loopSeconds(s.speed) * 1000;
  const duration = Math.ceil(VIDEO_MIN_SECONDS * 1000 / loopMs) * loopMs;
  const r = makeRenderer(s, W, H, bgColor(s) || '#ffffff', false);
  r.draw(0);
  const stream = r.canvas.captureStream(VIDEO_FPS);
  const rec = new MediaRecorder(stream, {
    mimeType: type,
    videoBitsPerSecond: Math.round(W * H * VIDEO_FPS * VIDEO_BITS_PER_PIXEL),
  });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise(res => { rec.onstop = res; });
  rec.start();
  await new Promise(done => {
    let start = 0;
    const step = now => {
      if (job.cancelled) return done();
      if (!start) start = now;
      const elapsed = now - start;
      if (elapsed >= duration) return done();
      r.draw((elapsed / loopMs) % 1);
      onProgress(elapsed / duration);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  rec.stop();
  await stopped;
  stream.getTracks().forEach(t => t.stop());
  r.destroy();
  if (job.cancelled) return null;
  return new Blob(chunks, { type: type.split(';')[0] });
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const prettySize = bytes => bytes < 1e6 ? Math.max(1, Math.round(bytes / 1e3)) + ' KB' : (bytes / 1e6).toFixed(1) + ' MB';

// Swaps the save buttons for a progress bar (label given) or back (label empty).
function setSaving(label) {
  els.saveBtns.hidden = !!label;
  els.saveProgress.hidden = !label;
  for (const b of els.sizes.children) b.disabled = !!label;
  if (label) { els.saveLabel.textContent = label; setProgress(0); }
}

function setProgress(f) {
  const pct = Math.round(f * 100);
  els.saveFill.style.width = pct + '%';
  els.saveBar.setAttribute('aria-valuenow', pct);
}

// kind: 'gif' or 'video'. Returns the finished File, or null if cancelled or failed.
async function save(kind, download = true) {
  if (job || !source) return null;
  const s = { ...settings };            // later slider moves don't change a save in progress
  job = { cancelled: false, kind };
  setSaving(kind === 'gif' ? 'Making your GIF…' : 'Recording your video…');
  els.saveNote.textContent = '';
  try {
    const blob = kind === 'gif' ? await makeGif(s, setProgress) : await makeVideo(s, setProgress);
    if (!blob) { els.saveNote.textContent = job.reason || 'Cancelled.'; return null; }
    const ext = kind === 'gif' ? 'gif' : blob.type === 'video/mp4' ? 'mp4' : 'webm';
    const file = new File([blob], `${sourceName}_wiggle.${ext}`, { type: blob.type });
    if (kind === 'gif') lastGif = { key: exportKey(s), file };
    if (download) downloadBlob(file, file.name);
    els.saveNote.textContent = `${download ? 'Saved' : 'Made'} ${file.name} (${prettySize(file.size)}) 🎉`;
    return file;
  } catch (err) {
    console.error(err);
    els.saveNote.textContent = "Oops, saving didn't work in this browser. Try the other button, or another browser.";
    return null;
  } finally {
    job = null;
    setSaving('');
  }
}

async function share() {
  if (!lastGif || lastGif.key !== exportKey(settings)) {
    if (!await save('gif', false)) return;
  }
  try {
    await navigator.share({ files: [lastGif.file], title: 'My wiggle' });
    els.shareBtn.textContent = '📤 Share';
  } catch (err) {
    // Making the GIF can outlast the tap that started it; the browser then wants a fresh tap.
    if (err.name === 'NotAllowedError') els.shareBtn.textContent = '📤 Ready! Tap to share';
    else if (err.name !== 'AbortError') els.saveNote.textContent = "Couldn't share from here. Try Download GIF instead.";
  }
}

// ---------------------------------------------------------------------------
// UI building
// ---------------------------------------------------------------------------
function styleIcon(style) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 60 40');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  const dot = document.createElementNS(NS, 'circle');
  dot.setAttribute('r', '4.5');
  if (style.bulge) {
    path.setAttribute('d', 'M30 6a14 14 0 1 1 0 28a14 14 0 1 1 0-28M30 14a6 6 0 1 1 0 12a6 6 0 1 1 0-12');
    dot.setAttribute('cx', '30'); dot.setAttribute('cy', '20'); dot.setAttribute('r', '3');
  } else {
    const ax = style.round ? 15 : 24, ay = 15;
    let d = '';
    for (let i = 0; i <= 64; i++) {
      const p = style.path(i / 64 * TAU);
      d += (i ? 'L' : 'M') + (30 + p.u * ax).toFixed(1) + ' ' + (20 + p.v * ay).toFixed(1);
    }
    path.setAttribute('d', d);
    const p0 = style.path(0);
    dot.setAttribute('cx', 30 + p0.u * ax); dot.setAttribute('cy', 20 + p0.v * ay);
  }
  svg.append(path, dot);
  return svg;
}

function buildStyleButtons() {
  for (const style of STYLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'style-btn';
    b.setAttribute('role', 'radio');
    b.dataset.id = style.id;
    b.title = style.name;
    b.append(styleIcon(style), style.name);
    b.addEventListener('click', () => { settings.style = style.id; syncUI(); saveSettings(); });
    els.styles.append(b);
  }
}

function buildSwatches() {
  const pick = id => { settings.bg = id; syncUI(); saveSettings(); applyBackground(); };
  for (const bg of BACKGROUNDS) {
    if (bg.id === 'custom') { buildCustomSwatch(bg, pick); continue; }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (bg.color ? '' : ' clear');
    if (bg.color) b.style.background = bg.color;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', bg.label);
    b.title = bg.label;
    b.dataset.id = bg.id;
    b.addEventListener('click', () => pick(bg.id));
    els.swatches.append(b);
  }
}

// The last swatch is a native colour picker laid invisibly over a rainbow-ringed dot,
// so tapping it opens the picker directly (the most reliable way across browsers).
function buildCustomSwatch(bg, pick) {
  const b = document.createElement('label');
  b.className = 'swatch custom';
  b.setAttribute('role', 'radio');
  b.title = bg.label;
  b.dataset.id = bg.id;
  const input = document.createElement('input');
  input.type = 'color';
  input.id = 'customBg';
  input.setAttribute('aria-label', bg.label);
  input.addEventListener('click', () => pick(bg.id));
  input.addEventListener('input', () => { settings.customBg = input.value; pick(bg.id); });
  b.append(input);
  els.swatches.append(b);
}

function buildSizes() {
  for (const size of SIZES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'size-btn';
    b.setAttribute('role', 'radio');
    b.dataset.id = size.id;
    b.textContent = size.name;
    b.addEventListener('click', () => { settings.size = size.id; syncUI(); saveSettings(); });
    els.sizes.append(b);
  }
}

// Arrow keys move between the buttons of a radio group, and only the chosen one
// is a Tab stop (the usual radio-button behaviour). syncUI keeps the tabindex right.
function radioKeys(group) {
  group.addEventListener('keydown', e => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    const items = [...group.children];
    const i = items.findIndex(b => b.contains(document.activeElement));
    if (i < 0) return;
    e.preventDefault();
    const next = items[(i + step + items.length) % items.length];
    const target = next.matches('label') ? next.querySelector('input') : next;
    target.focus();
    if (target.type !== 'color') target.click();   // the colour picker opens only when asked to
  });
}

function syncRadios(group, id) {
  for (const b of group.children) {
    const on = b.dataset.id === id;
    b.setAttribute('aria-checked', on);
    (b.matches('label') ? b.querySelector('input') : b).tabIndex = on ? 0 : -1;
  }
  if (![...group.children].some(b => b.dataset.id === id)) {
    const first = group.children[0];
    if (first && !first.matches('label')) first.tabIndex = 0;
  }
}

// Push settings into every control and readout.
function syncUI() {
  syncRadios(els.styles, settings.style);
  syncRadios(els.swatches, settings.bg);
  syncRadios(els.sizes, settings.size);
  els.wiggle.value = settings.wiggle;
  els.wander.value = settings.wander;
  els.speed.value = settings.speed;
  els.reverseChk.checked = settings.reverse;
  els.fitChk.checked = settings.fit;
  const custom = $('customBg');
  custom.value = settings.customBg;
  custom.parentNode.style.setProperty('--c', settings.customBg);
  els.wiggleOut.textContent = wiggleWord(settings.wiggle);
  els.wanderOut.textContent = wanderWord(settings.wander);
  els.speedOut.textContent = loopSeconds(settings.speed).toFixed(1) + 's loop';
  if (frameW && !job) {
    const { W, H } = exportSize(settings);
    els.saveNote.textContent = `${W} × ${H} pixels`;
    els.shareBtn.textContent = '📤 Share';
  }
}

function surprise() {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const range = (lo, hi) => Math.round(lo + Math.random() * (hi - lo));
  const others = STYLES.filter(s => s.id !== settings.style);
  settings.style = pick(others).id;
  settings.wiggle = range(25, 95);
  settings.wander = range(30, 100);
  settings.speed = range(25, 85);
  settings.reverse = Math.random() < 0.5;
  syncUI(); saveSettings();
}

// Split the title into letters so each one can bob on its own.
function wiggleTitle(el) {
  for (const node of [...el.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      [...node.textContent].forEach((ch, i) => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = ch === ' ' ? ' ' : ch;
        s.style.animationDelay = (-i * 0.17) + 's';
        s.setAttribute('aria-hidden', 'true');
        frag.append(s);
      });
      node.replaceWith(frag);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      wiggleTitle(node);
    }
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
function bindEvents() {
  const slider = (el, key) => el.addEventListener('input', () => {
    settings[key] = Number(el.value); syncUI(); saveSettings();
  });
  slider(els.wiggle, 'wiggle');
  slider(els.wander, 'wander');
  slider(els.speed, 'speed');
  els.reverseChk.addEventListener('change', () => { settings.reverse = els.reverseChk.checked; syncUI(); saveSettings(); });
  els.fitChk.addEventListener('change', () => { settings.fit = els.fitChk.checked; syncUI(); saveSettings(); });
  els.surpriseBtn.addEventListener('click', surprise);

  // Picking, dropping and pasting pictures
  els.pickBtn.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', () => {
    if (els.fileInput.files[0]) loadFile(els.fileInput.files[0]);
    els.fileInput.value = '';
  });
  let dragDepth = 0;
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragenter', e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth++; document.body.classList.add('dragging');
  });
  window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('dragleave', () => {
    if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); }
  });
  window.addEventListener('drop', e => {
    e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging');
    const file = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/')) || e.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  });
  window.addEventListener('paste', e => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); loadFile(item.getAsFile()); }
    else if (e.clipboardData?.files?.length) flashMessage("That doesn't look like a picture. Try a JPG, PNG, GIF or WebP.");
  });

  // Hold the picture to peek at the original
  const peek = on => { peeking = on; els.frame.classList.toggle('peek', on); };
  els.frame.addEventListener('pointerdown', e => { els.frame.setPointerCapture(e.pointerId); peek(true); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => els.frame.addEventListener(ev, () => peek(false)));
  els.frame.addEventListener('contextmenu', e => e.preventDefault());
  els.frame.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); if (!e.repeat) peek(true); } });
  els.frame.addEventListener('keyup', e => { if (e.key === ' ') peek(false); });
  els.frame.addEventListener('blur', () => peek(false));
  [els.styles, els.swatches, els.sizes].forEach(radioKeys);

  // Saving
  els.gifBtn.addEventListener('click', () => save('gif'));
  els.videoBtn.addEventListener('click', () => save('video'));
  els.shareBtn.addEventListener('click', share);
  els.cancelBtn.addEventListener('click', () => { if (job) job.cancelled = true; });
  document.addEventListener('visibilitychange', () => {
    // A hidden tab stops drawing frames, which would leave a frozen video.
    if (document.hidden && job && job.kind === 'video') {
      job.cancelled = true;
      job.reason = 'Video stopped because the tab was hidden. Keep it open while it records.';
    }
  });

  // Light/dark: the button picks one for good; until then, follow the device.
  els.themeBtn.addEventListener('click', () => {
    settings.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    saveSettings();
    applyTheme();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  // Help
  const help = show => {
    els.helpModal.hidden = !show;
    (show ? els.helpClose : els.helpBtn).focus();
  };
  els.helpBtn.addEventListener('click', () => help(true));
  els.helpClose.addEventListener('click', () => help(false));
  els.helpModal.addEventListener('click', e => { if (e.target === els.helpModal) help(false); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !els.helpModal.hidden) help(false); });

  new ResizeObserver(fitFrame).observe(els.stage);
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
function init() {
  wiggleTitle(els.title);
  buildStyleButtons();
  buildSwatches();
  buildSizes();
  els.shareBtn.hidden = !canShareFiles;
  els.videoBtn.hidden = !videoType();
  if (!STYLES.some(s => s.id === settings.style)) settings.style = DEFAULTS.style;
  if (!BACKGROUNDS.some(b => b.id === settings.bg)) settings.bg = DEFAULTS.bg;
  if (!/^#[0-9a-f]{6}$/i.test(settings.customBg)) settings.customBg = DEFAULTS.customBg;
  if (!SIZES.some(z => z.id === settings.size)) settings.size = DEFAULTS.size;
  if (!['light', 'dark'].includes(settings.theme)) settings.theme = null;
  applyTheme();
  syncUI();
  applyBackground();
  bindEvents();

  try {
    fxCanvas = fx.canvas();
  } catch {
    els.frame.hidden = true;
    showMessage("Oh no — your browser can't do the wiggle. It needs WebGL, which seems to be switched off or unsupported here.");
    return;
  }
  els.frame.prepend(fxCanvas);
  els.frame.hidden = true;
  showMessage('Loading…');
  const samples = window.SAMPLE_IMAGES;
  loadImageFromUrl(samples[Math.floor(Math.random() * samples.length)]).then(img => { if (!source) setSource(img, 'wiggle'); });
  requestAnimationFrame(tick);
}

init();
