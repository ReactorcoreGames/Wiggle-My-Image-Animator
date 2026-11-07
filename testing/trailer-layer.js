// Trailer layer: injected into the real app by testing/trailer.js. Trailer.frame(t)
// sets up frame t (seconds): it either drives the live app (UI scenes, with a drawn
// cursor and captions) or covers it with a card scene drawn with the app's own glfx
// renderer. The page's requestAnimationFrame is faked by trailer.js, so app time
// only moves when frame() pumps it. Landscape and portrait (Shorts) share the timeline.
(() => {
// Beat times of the music (librosa), in seconds. Bars start every 4th beat.
const BEATS = [1.02, 1.7, 2.37, 3.02, 3.69, 4.37, 5.02, 5.69, 6.36, 7.01, 7.69, 8.36, 9.01, 9.68, 10.36,
  11.03, 11.7, 12.35, 13.03, 13.7, 14.35, 15.02, 15.7, 16.37, 17.02, 17.69, 18.34, 19.02, 19.69, 20.36,
  21.01, 21.69, 22.36, 23.03, 23.68, 24.36, 25.03, 25.7, 26.35, 27.03, 27.7, 28.35, 29.0, 29.68, 30.35,
  31.02, 31.7, 32.37];
const B = i => BEATS[i];

const VW = innerWidth, VH = innerHeight, DPR = devicePixelRatio;
const L = VW > VH;                      // landscape (16:9) or portrait (Shorts)
const INK = '#2d2a12';
const PASTELS = ['#ffd6e0', '#d6ecff', '#d9f7d0', '#fff1b8', '#e6dcff', '#ffe0c7', '#cdf3ee', '#f6d8f0'];
const NAMES = ['spiky lemon', 'shaggy', 'motorbike', 'worm', 'lemon face', 'cyclops'];

const clamp01 = x => Math.max(0, Math.min(1, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = x => 1 - Math.pow(1 - clamp01(x), 3);
const backOut = x => { x = clamp01(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
// Seconds since the most recent beat/bar at or before t (big when none yet).
const sinceBeat = (t, step = 1) => { let d = 99; for (let i = 0; i < BEATS.length; i += step) if (BEATS[i] <= t) d = t - BEATS[i]; return d; };

// ---------------------------------------------------------------------------
// Overlay DOM
// ---------------------------------------------------------------------------
const css = document.createElement('style');
css.textContent = `
  #tr { position: fixed; inset: 0; z-index: 99999; pointer-events: none; overflow: hidden; font-family: "Fredoka", sans-serif; font-weight: 700; }
  #trBg, #trCanvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  .tx { position: absolute; left: 0; top: 0; white-space: nowrap; line-height: 1; will-change: transform; }
  .out { color: #fff; -webkit-text-stroke: .1em ${INK}; paint-order: stroke fill; text-shadow: 0 .05em 0 ${INK}, 0 .1em .1em rgba(0,0,0,.25); letter-spacing: .01em; }
  .out.zest { color: #ff8a3d; }
  .pill { background: ${INK}; color: #ffe45c; border-radius: 999px; padding: .32em .95em .36em; box-shadow: 0 .14em 0 rgba(0,0,0,.25); }
  .pill b { color: #fff; font-weight: 700; }
  .badge { background: #fff; color: ${INK}; border: .14em solid ${INK}; border-radius: .55em; padding: .18em .6em; box-shadow: 0 .17em 0 ${INK}; }
  .badge.leaf { background: #4caf50; color: #fff; } .badge.zest { background: #ff8a3d; color: #fff; }
  .icon svg { width: 100%; height: 100%; overflow: visible; }
  .icon path { fill: none; stroke: ${INK}; stroke-width: 3.6; stroke-linecap: round; stroke-linejoin: round; }
  .icon circle { fill: #ff8a3d; stroke: ${INK}; stroke-width: 2; }
  .file { background: #fff; border: 3px solid ${INK}; border-radius: 14px; padding: 6px 6px 4px; box-shadow: 0 5px 0 ${INK}; font: 600 14px "Fredoka", sans-serif; color: ${INK}; text-align: center; }
  .file img { display: block; width: 92px; height: 92px; object-fit: contain; }
  .ring { border: 4px solid #ff8a3d; border-radius: 50%; }
  .touch { background: rgba(255,255,255,.55); border: 3px solid rgba(45,42,18,.75); border-radius: 50%; }
`;
document.head.append(css);
const root = document.createElement('div');
root.id = 'tr';
root.innerHTML = '<div id="trBg"></div><canvas id="trCanvas"></canvas><div id="trText"></div><div id="trTop"></div>';
document.body.append(root);
const bgEl = root.querySelector('#trBg'), textEl = root.querySelector('#trText'), topEl = root.querySelector('#trTop');
const canvas = root.querySelector('#trCanvas');
canvas.width = Math.round(VW * DPR); canvas.height = Math.round(VH * DPR);
const ctx = canvas.getContext('2d');

// A positioned element. place() puts its anchor (ax, ay: 0..1 of its own box) at x, y.
function tx(html, cls, size) {
  const el = document.createElement('div');
  el.className = 'tx ' + cls;
  el.innerHTML = html;
  el.style.fontSize = size + 'px';
  textEl.append(el);
  return el;
}
function place(el, x, y, { s = 1, o = 1, ax = 0.5, ay = 0.5, rot = 0 } = {}) {
  el.style.transform = `translate(${x}px, ${y}px) translate(${-ax * 100}%, ${-ay * 100}%) rotate(${rot}deg) scale(${s})`;
  el.style.transformOrigin = `${ax * 100}% ${ay * 100}%`;
  el.style.opacity = o;
}
// Pops in at t0 (back-out scale), hidden before.
const pop = (t, t0, dur = 0.32, from = 0.3) => t < t0 ? { s: from, o: 0 } : { s: lerp(from, 1, backOut((t - t0) / dur)), o: clamp01((t - t0) / 0.08) };
// Slams in from big at t0.
const slam = (t, t0, dur = 0.2) => t < t0 ? { s: 2, o: 0 } : { s: lerp(2, 1, easeOut((t - t0) / dur)), o: clamp01((t - t0) / 0.1) };

function sunburst(t, x, y) {
  bgEl.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,.55), transparent 55%),
    repeating-conic-gradient(from ${t * 8}deg at ${x}% ${y}%, #ffd60a 0deg 9deg, #ffe45c 9deg 18deg)`;
}
function dotted(color, dots = 'rgba(255,255,255,.6)') {
  bgEl.style.background = `radial-gradient(${dots} 3px, transparent 3.5px) 0 0 / 30px 30px, ${color}`;
}

// ---------------------------------------------------------------------------
// Pictures and clips (the app's own effect, any picture)
// ---------------------------------------------------------------------------
const pics = [];
// effectAt/composeFrame/fitZoom read the current picture from the app's globals,
// so swap a picture's record in around each call.
function withPic(p, fn) {
  const keep = { source, frameW, frameH, imgRect, outline, sourceId };
  source = p.source; frameW = p.frameW; frameH = p.frameH; imgRect = p.imgRect; outline = p.outline; sourceId = p.id;
  try { return fn(); } finally {
    ({ source, frameW, frameH, imgRect, outline, sourceId } = keep);
  }
}
function clip(i, set, long = 720) {
  const p = pics[i];
  const s = { ...DEFAULTS, fit: true, ...set };
  return withPic(p, () => {
    const z = fitZoom(s);
    const k = long / Math.max(p.frameW, p.frameH);
    const W = Math.round(p.frameW * k), H = Math.round(p.frameH * k);
    if (!exportFx) exportFx = fx.canvas();
    const tex = exportFx.texture(composeFrame(W, H, z));
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const cc = c.getContext('2d');
    const loop = loopSeconds(s.speed);
    return {
      W, H, loop,
      // Loop position from seconds since start (still = the plain picture).
      render(sec, still) {
        withPic(p, () => {
          const chain = exportFx.draw(tex);
          (still ? chain : applyEffect(chain, effectAt(((sec / loop) % 1 + 1) % 1, s, W, H, z))).update();
        });
        cc.clearRect(0, 0, W, H);
        cc.drawImage(exportFx, 0, 0);
        return c;
      },
    };
  });
}
// Draws clip c centred at cx, cy, fitted into a bw×bh box.
function drawClip(c, sec, cx, cy, bw, bh, { s = 1, still = false, shadow = 0, rot = 0 } = {}) {
  const img = c.render(sec, still);
  const k = Math.min(bw / c.W, bh / c.H) * s;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot * Math.PI / 180);
  if (shadow) { ctx.shadowColor = 'rgba(45,42,18,.85)'; ctx.shadowOffsetY = shadow; }
  ctx.drawImage(img, -c.W * k / 2, -c.H * k / 2, c.W * k, c.H * k);
  ctx.restore();
}
let checker;
function checkerPattern() {
  if (!checker) {
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 24, 24);
    g.fillStyle = '#ece6c8'; g.fillRect(0, 0, 12, 12); g.fillRect(12, 12, 12, 12);
    checker = ctx.createPattern(c, 'repeat');
  }
  return checker;
}
// A bordered card with a background (null = checkerboard) and a wiggling clip inside.
function card(c, sec, cx, cy, w, h, bg, { s = 1, rot = 0, border = 5, radius = 22 } = {}) {
  if (s <= 0.001) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot * Math.PI / 180);
  ctx.scale(s, s);
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2 + border * 1.4, w, h, radius);
  ctx.fillStyle = INK; ctx.fill();                                     // drop "shadow"
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, radius);
  ctx.fillStyle = bg || checkerPattern(); ctx.fill();
  ctx.save(); ctx.clip();
  const img = c.render(sec);
  const k = Math.min(w / c.W, h / c.H);
  ctx.drawImage(img, -c.W * k / 2, -c.H * k / 2, c.W * k, c.H * k);
  ctx.restore();
  ctx.lineWidth = border; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Driving the app
// ---------------------------------------------------------------------------
function appState({ pic, theme, set }) {
  Object.assign(settings, DEFAULTS, { fit: true }, set, { theme });
  applyTheme();
  if (pic != null) setSource(pics[pic].img, NAMES[pic] + '.png');
  syncUI();
  applyBackground();
}
const rect = el => el.getBoundingClientRect();
const at = (el, fx = 0.5, fy = 0.5) => { const r = rect(el); return { x: r.left + r.width * fx, y: r.top + r.height * fy }; };
const THUMB = 14;   // half the slider thumb's width, CSS px
const thumbAt = (el, v) => { const r = rect(el); return { x: r.left + THUMB + (r.width - 2 * THUMB) * v / 100, y: r.top + r.height / 2 }; };
// Scrolls the page so el's box sits with its top at frac of the viewport height.
function scrollToEl(el, frac) { scrollTo(0, 0); scrollTo(0, rect(el).top - VH * frac); }

// Cursor (arrow on desktop, a touch dot on phones) along keyframes [{ t, x, y }].
const cursor = document.createElement('div');
cursor.className = 'tx';
cursor.innerHTML = L
  ? `<svg width="38" height="38" viewBox="0 0 24 24"><path d="M4 2.5l15 7.4-6.6 1.9L9.6 19z" fill="#fff" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/></svg>`
  : '<div class="touch" style="width:44px;height:44px"></div>';
const ring = document.createElement('div');
ring.className = 'tx ring';
function showCursor(on) { (on ? topEl.append(cursor, ring) : (cursor.remove(), ring.remove())); }
function moveCursor(t, keys, clicks = [], press = []) {
  let p = keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t >= a.t && t < b.t) { const k = ease((t - a.t) / (b.t - a.t)); p = { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) }; break; }
    if (t >= b.t) p = b;
  }
  const pressed = press.some(([a, b]) => t >= a && t < b) || clicks.some(c => t >= c && t < c + 0.12);
  // Arrow tip sits at the point; the touch dot is centred on it.
  place(cursor, p.x, p.y, L ? { ax: 0.1, ay: 0.06, s: pressed ? 0.85 : 1 } : { s: pressed ? 0.8 : 1, o: pressed ? 1 : 0.85 });
  const last = clicks.filter(c => c <= t).pop();
  const d = last == null ? 9 : t - last;
  ring.style.width = ring.style.height = lerp(16, 70, easeOut(d / 0.4)) + 'px';
  place(ring, p.x, p.y, { o: d < 0.4 ? 1 - d / 0.4 : 0 });
  return p;
}

// Bottom caption for UI scenes: a dark pill, swapped with a pop.
function caption(portraitY = () => VH * 0.115) {
  const el = tx('', 'pill', L ? 34 : 22);
  let cur = '';
  return (t, text, t0) => {
    if (text !== cur) { el.innerHTML = text; cur = text; }
    const stage = rect($('stageCard'));
    const x = L ? stage.left + stage.width / 2 : VW / 2;
    const y = L ? Math.min(VH - 46, stage.bottom + (VH - stage.bottom) / 2 + 6) : portraitY();
    place(el, x, y, pop(t, t0, 0.3, 0.6));
  };
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------
let hero, styleClips, bgClip, wallClips;
const HERO_SET = { style: 'infinity', wiggle: 62, wander: 58, speed: 58 };
const STYLE_PICS = [0, 5, 1, 2, 3, 5, 0, 4];
const BG_SHOTS = [
  { color: null, label: 'See-through' },
  { color: '#00ff00', label: 'Green screen' },
  { color: '#000000', label: 'Black' },
  { color: '#ff00ff', label: 'Magenta' },
];
const WALL = [
  [0, 'circle', '#ffd6e0'], [5, 'eight', '#d6ecff'], [2, 'side', '#d9f7d0'],
  [3, 'updown', '#fff1b8'], [4, 'breathe', '#e6dcff'], [1, 'diag2', '#ffe0c7'],
];

// The title (cover layout). Returns an updater taking per-word {s, o}.
function titleWords() {
  const sizes = L ? [200, 136, 88] : [96, 66, 44];
  const words = [tx('WIGGLE', 'out', sizes[0]), tx('MY IMAGE', 'out', sizes[1]), tx('ANIMATOR', 'out zest', sizes[2])];
  return (anims, dx = 0) => {
    let y = L ? 46 : VH * 0.05;
    words.forEach((w, i) => {
      const h = sizes[i] * 0.95;
      if (L) place(w, 52 + dx, y, { ax: 0, ay: 0, ...anims[i] });
      else place(w, VW / 2, y, { ax: 0.5, ay: 0, ...anims[i] });
      y += h + (L ? 6 : 4);
    });
  };
}

const scenes = [
  { // Cold open → the hit: a still mascot, then it wiggles on the first beat.
    t0: 0, t1: B(4),
    enter() {
      this.q = tx('Got a picture?', 'out', L ? 96 : 54);
      this.w = tx(`Make it${L ? ' ' : '<br>'}<span style="color:#ff8a3d">WIGGLE!</span>`, 'out', L ? 128 : 66);
      this.w.style.textAlign = 'center';
    },
    draw(t) {
      sunburst(t, 50, L ? 60 : 58);
      const cy = L ? VH * 0.6 : VH * 0.56, box = L ? VH * 0.7 : VW * 0.92;
      const bump = t >= B(0) ? 1 + 0.08 * Math.exp(-sinceBeat(t, 4) * 7) : 1;
      drawClip(hero, t - B(0), VW / 2, cy, box, box, { still: t < B(0), s: bump, shadow: L ? 12 : 8 });
      const ty = L ? VH * 0.14 : VH * 0.2;
      place(this.q, VW / 2, ty, t < B(0) ? pop(t, 0.12, 0.35) : { o: 0 });
      place(this.w, VW / 2, ty, slam(t, B(0)));
    },
  },
  { // Title card
    t0: B(4), t1: B(8),
    enter() {
      this.title = titleWords();
      this.tag = tx('Drop a picture <b>→</b> it wiggles <b>→</b> save a GIF!', 'pill', L ? 40 : 19);
    },
    draw(t) {
      sunburst(t, L ? 70 : 50, L ? 55 : 66);
      const bump = 1 + 0.05 * Math.exp(-sinceBeat(t, 4) * 7);
      if (L) drawClip(hero, t - B(0), VW * 0.72, VH * 0.5, VH * 0.88, VH * 0.88, { s: bump, shadow: 12 });
      else drawClip(hero, t - B(0), VW / 2, VH * 0.66, VW * 0.95, VW * 0.95, { s: bump, shadow: 8 });
      this.title([slam(t, B(4)), slam(t, B(5)), slam(t, B(6))]);
      place(this.tag, L ? 52 : VW / 2, L ? VH * 0.83 : VH * 0.425, { ax: L ? 0 : 0.5, ...pop(t, B(7)) });
    },
  },
  { // App: drop a picture in, and it's already wiggling
    t0: B(8), t1: B(12), app: true,
    enter() {
      appState({ pic: 4, theme: 'light', set: { style: 'infinity', wiggle: 45, wander: 55, bg: 'white' } });
      scrollTo(0, 0);
      this.cap = caption();
      this.dropped = false;
      showCursor(true);
      if (L) {
        this.file = tx(`<img src="${pics[1].img.src}">monster.png`, 'file', 14);
        // Hold the file just under the "Drop it like it's hot" text, then move off the picture.
        const f = rect(els.frame), c = { x: f.left + f.width * 0.36, y: f.top + f.height * 0.74 };
        this.keys = [{ t: B(8), x: VW + 80, y: VH * 0.75 }, { t: B(8) + 1.1, ...c }, { t: B(10), ...c }, { t: B(11) + 0.4, x: f.left + f.width * 0.9, y: f.top + f.height * 0.85 }];
      } else {
        const b = at(els.pickBtn);
        this.keys = [{ t: B(8), x: VW * 0.8, y: VH * 0.9 }, { t: B(9) + 0.2, x: b.x, y: b.y }, { t: B(11), x: b.x, y: b.y }, { t: B(11) + 0.5, x: VW * 0.85, y: VH * 0.92 }];
      }
    },
    draw(t) {
      bgEl.style.background = 'none';
      if (L) {
        document.body.classList.toggle('dragging', t >= B(8) + 0.55 && t < B(10));
        const p = moveCursor(t, this.keys);
        const k = t < B(10) ? 1 : 1 - clamp01((t - B(10)) / 0.15);
        place(this.file, p.x + 10, p.y + 16, { ax: 0, ay: 0, rot: -6, s: k, o: k > 0.05 ? 1 : 0 });
      } else {
        moveCursor(t, this.keys, [B(10) - 0.3]);
      }
      if (t >= B(10) && !this.dropped) { this.dropped = true; setSource(pics[1].img, 'monster.png'); }
      if (t < B(10)) this.cap(t, 'Drop in a picture…', B(8));
      else this.cap(t, '…and it’s <b>already wiggling!</b>', B(10));
    },
    leave() { document.body.classList.remove('dragging'); showCursor(false); },
  },
  { // Eight styles, one per beat
    t0: B(12), t1: B(20),
    enter() {
      this.head = tx('8 wiggle styles', 'pill', L ? 36 : 22);
      this.icons = STYLES.map(st => { const el = tx('', 'icon', 10); el.append(styleIcon(st)); el.style.width = (L ? 230 : 150) + 'px'; el.style.height = (L ? 154 : 100) + 'px'; return el; });
      this.names = STYLES.map(st => tx(st.name, 'out', L ? 104 : 62));
      this.dots = STYLES.map(() => { const d = tx('', '', 10); d.style.cssText += `width:16px;height:16px;border-radius:50%;border:3px solid ${INK};`; return d; });
    },
    draw(t) {
      let k = 0;
      while (k < 7 && t >= B(13 + k)) k++;
      const t0 = B(12 + k);
      dotted(PASTELS[k]);
      const lx = L ? VW * 0.25 : VW / 2;
      place(this.head, lx, L ? VH * 0.15 : VH * 0.075, pop(t, B(12), 0.3, 0.6));
      this.icons.forEach((el, i) => place(el, lx, L ? VH * 0.42 : VH * 0.16, i === k ? pop(t, t0, 0.28, 0.5) : { o: 0 }));
      this.names.forEach((el, i) => place(el, lx, L ? VH * 0.64 : VH * 0.27, i === k ? pop(t, t0, 0.28, 0.6) : { o: 0 }));
      this.dots.forEach((el, i) => {
        el.style.background = i <= k ? '#ff8a3d' : '#fff';
        place(el, lx + (i - 3.5) * 26, L ? VH * 0.77 : VH * 0.335);
      });
      const bump = 1 + 0.05 * Math.exp(-(t - t0) * 8);
      if (L) drawClip(styleClips[k], t - t0 + 0.15, VW * 0.65, VH * 0.53, VH * 0.86, VH * 0.86, { s: bump, shadow: 10 });
      else drawClip(styleClips[k], t - t0 + 0.15, VW / 2, VH * 0.62, VW * 0.96, VH * 0.5, { s: bump, shadow: 8 });
    },
  },
  { // App: sliders, then Surprise me
    t0: B(20), t1: B(28), app: true,
    enter() {
      appState({ pic: 5, theme: 'dark', set: { style: 'circle', wiggle: 30, wander: 50, speed: 55, bg: 'custom', customBg: '#ffd6e0' } });
      if (!L) {
        // Phones: a shorter stage, so the picture and the sliders fit on screen together.
        els.stage.style.maxHeight = '30vh';
        $('stageTip').hidden = true;
        els.pickBtn.style.visibility = 'hidden';   // the caption sits on its row
        fitFrame();
        scrollTo(0, 0);
        scrollTo(0, rect(els.speed).bottom - VH * 0.975);
      }
      this.cap = caption(() => at(els.pickBtn).y);
      showCursor(true);
      const sb = at(els.surpriseBtn);
      const w0 = thumbAt(els.wiggle, 30), w1 = thumbAt(els.wiggle, 95);
      const d0 = thumbAt(els.wander, 50), d1 = thumbAt(els.wander, 95);
      this.drags = [[B(20) + 0.5, B(22) + 0.2, els.wiggle, 30, 95], [B(22) + 0.55, B(24) - 0.05, els.wander, 50, 95]];
      const start = L ? { x: VW * 0.55, y: VH * 0.55 } : { x: VW * 0.5, y: VH * 0.5 };
      this.keys = [
        { t: B(20), ...start }, { t: B(20) + 0.45, ...w0 }, { t: this.drags[0][0], ...w0 }, { t: this.drags[0][1], ...w1 },
        { t: B(22) + 0.5, ...d0 }, { t: this.drags[1][0], ...d0 }, { t: this.drags[1][1], ...d1 },
        { t: B(24) + 0.45, ...sb }, { t: B(28), ...sb },
      ];
      this.clicks = [B(25), B(26), B(27)];
      this.done = 0;
    },
    draw(t) {
      bgEl.style.background = 'none';
      for (const [a, b, el, v0, v1] of this.drags) {
        if (t < a || t > b + 0.1) continue;
        const v = Math.round(lerp(v0, v1, ease((t - a) / (b - a))));
        if (Number(el.value) !== v) { el.value = v; el.dispatchEvent(new Event('input')); }
      }
      while (this.done < this.clicks.length && t >= this.clicks[this.done]) { els.surpriseBtn.click(); this.done++; }
      moveCursor(t, this.keys, this.clicks, this.drags.map(d => [d[0] - 0.05, d[1] + 0.05]));
      if (t < B(24)) this.cap(t, 'Tweak <b>Wiggliness</b>, <b>Wander</b> &amp; <b>Speed</b>', B(20));
      else this.cap(t, '…or hit <b>🎲 Surprise me!</b>', B(24));
    },
    leave() { showCursor(false); els.stage.style.maxHeight = ''; $('stageTip').hidden = false; els.pickBtn.style.visibility = ''; fitFrame(); },
  },
  { // Backgrounds, one per beat
    t0: B(28), t1: B(32),
    enter() {
      this.head = tx('See-through, green screen,<br>any colour', 'out', L ? 64 : 30);
      this.head.style.textAlign = 'center'; this.head.style.lineHeight = '1.05';
      this.labels = BG_SHOTS.map(b => tx(b.label, 'pill', L ? 30 : 20));
      const colors = [null, '#ffffff', '#000000', '#00ff00', '#ff00ff', 'rainbow'];
      this.sw = colors.map(c => {
        const d = tx('', '', 10);
        d.style.cssText += `width:${L ? 46 : 34}px;height:${L ? 46 : 34}px;border-radius:50%;border:3px solid ${INK};box-shadow:0 3px 0 ${INK};`;
        d.style.background = c === null ? 'repeating-conic-gradient(#ece6c8 0 25%, #fff 0 50%) 0 0 / 16px 16px'
          : c === 'rainbow' ? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' : c;
        return d;
      });
      this.map = [0, 3, 2, 4];   // which swatch each shot highlights
    },
    draw(t) {
      let k = 0;
      while (k < 3 && t >= B(29 + k)) k++;
      const t0 = B(28 + k);
      dotted('#fff8d6', '#ffe98a');
      place(this.head, VW / 2, L ? VH * 0.12 : VH * 0.14, pop(t, B(28), 0.3, 0.6));
      const cw = L ? VH * 0.92 : VW * 0.88, ch = cw / (bgClip.W / bgClip.H);
      const cy = L ? VH * 0.52 : VH * 0.47;
      card(bgClip, t - B(28), VW / 2, cy, cw, ch, BG_SHOTS[k].color, { s: 1 + 0.03 * Math.exp(-(t - t0) * 8), border: L ? 6 : 4 });
      this.labels.forEach((el, i) => place(el, VW / 2, cy - ch / 2 + (L ? 4 : 2), i === k ? { ay: 0.5, ...pop(t, t0, 0.25, 0.6) } : { o: 0 }));
      const sy = cy + ch / 2 + (L ? 62 : 50), gap = L ? 62 : 46;
      this.sw.forEach((el, i) => place(el, VW / 2 + (i - 2.5) * gap, sy, { s: i === this.map[k] ? 1.3 + 0.15 * Math.exp(-(t - t0) * 8) : 0.9 }));
    },
  },
  { // App: save a GIF
    t0: B(32), t1: B(36), app: true,
    enter() {
      appState({ pic: 2, theme: 'light', set: { style: 'side', wiggle: 55, wander: 60, bg: 'custom', customBg: '#cdf3ee', size: 'l' } });
      scrollTo(0, 0);
      // Phones scroll from the picture down to the Save buttons first.
      this.scroll = L ? 0 : rect(els.sizes).top - VH * 0.5;
      this.cap = caption();
      showCursor(true);
      const g = at(els.gifBtn, 0.42, 0.55);
      g.y -= this.scroll;
      const go = L ? B(32) : B(32) + 0.25;
      this.keys = [{ t: go, x: VW * 0.5, y: VH * (L ? 0.45 : 0.8) }, { t: go + 0.45, ...g }, { t: B(36), ...g }];
      this.click = B(33);
      this.state = 0;
    },
    draw(t) {
      bgEl.style.background = 'none';
      if (!L) scrollTo(0, this.scroll * ease((t - B(32)) / 0.55));
      if (this.state === 0 && t >= this.click) { this.state = 1; setSaving('Making your GIF…'); els.saveNote.textContent = ''; }
      if (this.state === 1) setProgress(ease((t - this.click) / (B(35) - 0.15 - this.click)));
      if (this.state === 1 && t >= B(35)) {
        this.state = 2; setSaving('');
        els.saveNote.textContent = 'Saved motorbike_wiggle.gif (1.3 MB) 🎉';
      }
      moveCursor(t, this.keys, [this.click]);
      this.cap(t, 'Save a looping <b>GIF</b> or <b>video</b>', B(32));
    },
    leave() { showCursor(false); setSaving(''); syncUI(); },
  },
  { // Wall of wiggles
    t0: B(36), t1: B(40),
    enter() {
      this.head = tx('Wiggle <span style="color:#ff8a3d">anything!</span>', 'out', L ? 84 : 50);
      this.tag = tx('Memes · emotes · stickers · group chats', 'pill', L ? 32 : 18);
    },
    draw(t) {
      sunburst(t, 50, 50);
      place(this.head, VW / 2, L ? VH * 0.1 : VH * 0.1, pop(t, B(36), 0.3, 0.6));
      const cols = L ? 3 : 2, rows = L ? 2 : 3;
      const gx = L ? VW * 0.08 : VW * 0.06, top = L ? VH * 0.2 : VH * 0.17, bottom = L ? VH * 0.86 : VH * 0.72;
      const gap = L ? 26 : 14;
      const cw = (VW - 2 * gx - (cols - 1) * gap) / cols, chh = (bottom - top - (rows - 1) * gap) / rows;
      WALL.forEach((w, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const x = gx + c * (cw + gap) + cw / 2, y = top + r * (chh + gap) + chh / 2;
        const t0 = B(36 + Math.floor(i / 2));
        const { s } = pop(t, t0 + (i % 2) * 0.08, 0.3, 0);
        card(wallClips[i], t - B(36) + i * 0.3, x, y, cw, chh, w[2], { s: t < t0 ? 0 : s, rot: [-3, 2, -1.5, 2.5, -2, 1.5][i], border: L ? 5 : 3, radius: L ? 20 : 14 });
      });
      place(this.tag, VW / 2, L ? VH * 0.94 : VH * 0.775, pop(t, B(38), 0.3, 0.6));
    },
  },
  { // End card
    t0: B(40), t1: 99,
    enter() {
      this.title = titleWords();
      this.url = tx('▶ <b>reactorcore.itch.io</b>/wiggle-my-image-animator', 'pill', L ? 34 : 17);
      this.badges = [tx('8 wiggle styles', 'badge', L ? 30 : 17), tx('GIF + video', 'badge leaf', L ? 30 : 17), tx('Plays in your browser', 'badge zest', L ? 30 : 17)];
      this.by = tx('Made by Reactorcore', 'out', L ? 30 : 20);
      this.by.style.webkitTextStroke = '.12em ' + INK;
    },
    draw(t) {
      sunburst(t, L ? 70 : 50, L ? 55 : 52);
      const bump = 1 + 0.04 * Math.exp(-sinceBeat(t, 4) * 7);
      if (L) drawClip(hero, t - B(0), VW * 0.72, VH * 0.47, VH * 0.82, VH * 0.82, { s: bump, shadow: 12 });
      else drawClip(hero, t - B(0), VW / 2, VH * 0.48, VW * 0.8, VW * 0.8, { s: bump, shadow: 8 });
      this.title([pop(t, B(40), 0.3, 0.5), pop(t, B(40) + 0.1, 0.3, 0.5), pop(t, B(40) + 0.2, 0.3, 0.5)]);
      if (L) {
        place(this.url, 52, VH * 0.745, { ax: 0, ...pop(t, B(41), 0.3, 0.6) });
        let x = 52;
        this.badges.forEach((b, i) => { place(b, x, VH * 0.87, { ax: 0, ...pop(t, B(42) + i * 0.1, 0.3, 0.5) }); x += b.offsetWidth + 16; });
        place(this.by, VW - 40, VH - 34, { ax: 1, ...pop(t, B(43), 0.3, 0.6) });
      } else {
        place(this.url, VW / 2, VH * 0.71, pop(t, B(41), 0.3, 0.6));
        const ws = this.badges.map(b => b.offsetWidth);
        // Two badges on one row, the third under them.
        let x = VW / 2 - (ws[0] + ws[1] + 8) / 2;
        place(this.badges[0], x, VH * 0.77, { ax: 0, ...pop(t, B(42), 0.3, 0.5) });
        place(this.badges[1], x + ws[0] + 8, VH * 0.77, { ax: 0, ...pop(t, B(42) + 0.1, 0.3, 0.5) });
        place(this.badges[2], VW / 2, VH * 0.825, pop(t, B(42) + 0.2, 0.3, 0.5));
        place(this.by, VW / 2, VH * 0.875, pop(t, B(43), 0.3, 0.6));
      }
    },
  },
];

// ---------------------------------------------------------------------------
// Frame stepping
// ---------------------------------------------------------------------------
let current = null;
function stepAnimations(t) {
  for (const a of document.getAnimations()) {
    if (a.__t0 == null) { a.__t0 = t; a.pause(); }
    a.currentTime = (t - a.__t0) * 1000;
  }
}

window.Trailer = {
  async setup() {
    for (let i = 0; i < SAMPLE_IMAGES.length; i++) {
      const img = await loadImageFromUrl(SAMPLE_IMAGES[i]);
      setSource(img, NAMES[i] + '.png');
      pics.push({ img, source, frameW, frameH, imgRect, outline, id: 1000 + i });
    }
    hero = clip(0, HERO_SET);
    styleClips = STYLES.map((st, i) => clip(STYLE_PICS[i], { style: st.id, wiggle: st.bulge ? 85 : 70, wander: 60, speed: 72 }));
    bgClip = clip(3, { style: 'eight', wiggle: 60, wander: 60, speed: 60 });
    wallClips = WALL.map(([p, style]) => clip(p, { style, wiggle: 60, wander: 60, speed: 60 }, 480));
    await document.fonts.load('700 40px Fredoka');
    await document.fonts.load('600 40px Fredoka');
  },
  frame(t) {
    const scene = scenes.find(s => t >= s.t0 && t < s.t1);
    if (scene !== current) {
      current?.leave?.();
      textEl.innerHTML = '';
      current = scene;
      scene.enter();
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    // Hidden, not just cleared, in UI scenes: headless Edge kept showing the last card.
    canvas.style.visibility = scene.app ? 'hidden' : '';
    scene.draw(t);
    window.__pump(1000 + t * 1000);
    stepAnimations(t);
  },
};
})();
