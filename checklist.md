# Wiggle My Image Animator — changelog and open items

The rebuild ran in five sessions on 2026-11-07/08; the project is now in maintenance. How everything works is in [CLAUDE.md](CLAUDE.md). This file keeps a short history and whatever is still open.

## Open items (the author)

- [ ] Real-phone test (iOS Safari + Android Chrome) and itch.io embed test on the itch page. Try: pick a photo (incl. an iPhone HEIC from Photos; iOS normally converts it to JPG), Download GIF at Large (time it; if slow, consider fewer palette samples or a smaller default size), Download video (MP4 on iOS?), Share (does "Ready! Tap to share" appear?), and downloads from inside the itch embed on desktop. Report anything odd to a new session.
- [ ] Upload `trailer/trailer.mp4` and `trailer/trailer_shorts.mp4` to YouTube with the copypastas in [promo.md](promo.md), then link the trailer on the itch page.
- [ ] Move the folder to `c:/14 Repos` and commit with GitHub Desktop (the cleanup is done, see Session 5).

## Changelog

### Session 1 — Core rebuild (2026-11-07)

Rebuilt from scratch (old prototype moved to `old wip/`). Lemon theme with dark mode, file picker / drag-and-drop / paste, big pictures shrunk, extreme shapes letterboxed (1:2 to 2:1), tiny pictures upscaled crisp. Eight seamless styles with icons drawn from the real paths, Reverse, Show path, three sliders, 🎲 Surprise me, hold to peek, settings remembered. GPU texture uploaded once per picture (the old prototype leaked one per frame). Background drawn under the effect to avoid see-through holes at the edges.

### Session 2 — Saving and sharing (2026-11-07)

Vendored gifenc. Download GIF / Download video / Share, Small / Medium / Large, progress bar with Cancel. GIFs at 25 fps with one shared `rgb444` palette (per-frame `rgb565` palettes took ~1.3 s per frame on photos; the shared one is 10× quicker and stops flat areas shimmering). Videos are recorded in real time for whole loops ≥3 s (MP4 where supported). Verified with ffprobe, including a seamless last→first frame join.

Feedback round: backgrounds became see-through / white / black / green screen / magenta / custom colour; added "Stay in frame" (automatic zoom that keeps the whole wiggle inside the frame, verified on every style at strong settings).

### Session 3 — Polish (2026-11-07)

Edge cases (HEIC message, animated GIF input, EXIF rotation, 1×1 and huge pictures, non-images), keyboard support (radio groups with arrow keys, Space to peek), rendering paused while help is open, og/twitter meta tags, copy pass. Real-phone and itch embed tests deferred (see Open items).

### Session 4 — Release materials (2026-11-07)

`readme.md`, `guide.md`, `promo.md`, MIT `LICENSE`, `promo/` images and `gifs/` demo GIFs made from the real app by `testing/promo-shots.js`, `build_release.bat` producing the offline zip and an itch-ready web zip. Added a 🌙/☀️ theme toggle after feedback. Gotcha: Git's GNU tar silently writes a tar named `.zip`, so the .bat calls Windows' own `tar.exe`.

### Session 5 — Cleanup, graduation, trailer (2026-11-08)

- [x] Phone/itch test results: not done yet by the author, so nothing to fix; release rebuilt.
- [x] Cleanup: early notes from `docs/` moved to `old wip/docs notes/`; `.gitignore` added (old wip, dist, .claude, node_modules, the trailer music and videos, test outputs, OS clutter); CLAUDE.md rewritten for maintenance; this checklist trimmed to a changelog.
- [x] All-clear given to move the project to `c:/14 Repos`.
- [x] YouTube trailer, 32 s, music "Cafecito por la Mañana" (Cumbia Deli, YouTube Audio Library), trimmed at 32 s with a fade over the last bar. 16:9 1080p plus a 9:16 Shorts cut. Plan and shot list in `trailer/trailer.md`; rendered frame-exact by `testing/trailer.js` (fake rAF + per-frame screenshots of the real app, piped to ffmpeg). Title/description/tags in `promo.md`.

Notes: librosa's 89.1 BPM estimate drifts ~0.3 s by the end; the real tempo is ~90 BPM, so the trailer uses the detected beat times directly. The music licence forbids distributing the file on its own, so the mp3 is gitignored and must never go into a release zip. On the Shorts cut, UI scenes use the app's phone layout; the slider scene shrinks the stage for its duration so the picture and the sliders fit on screen together, and the save scene scrolls from the picture down to the button.
