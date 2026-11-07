# Trailer plan — Wiggle My Image Animator

Music: "Cafecito por la Mañana" by Cumbia Deli (YouTube Audio Library; no attribution required, but the file may not be distributed on its own, so it stays out of git and the release zip). Used from the start, trimmed at 32 s with a fade over the last bar (30.35 → 32.0 s).

## Music analysis (first 40 s)

- 89 BPM: one beat ≈ 0.673 s, one bar (4 beats) ≈ 2.69 s.
- The music comes in at ~1.02 s; before that it is near-silent.
- Bars start at 1.02, 3.69, 6.36, 9.01, 11.70, 14.35, 17.02, 19.69, 22.36, 25.03, 27.70, 30.35 s.
- Phrase changes (chroma segmentation) around 9.0, 21–22.4 and 31.8 s. Energy is steady (a cumbia groove), so cuts land on bars and beats, with the busiest montage (one style per beat) in the 9–14 s phrase.

## Approach

All footage is rendered frame-exact by `testing/trailer.js`: it opens the real app in headless Edge with a fake `requestAnimationFrame`, steps time by 1/30 s, and screenshots every frame. App UI scenes are the live app driven by script (with a drawn cursor). Card scenes are drawn on top of the app in an overlay using the app's own glfx renderer, so every wiggle is the real effect. Text is Fredoka with dark outlines, matching the cover. No pricing claims ("Web app", "in your browser").

16:9 at 1920×1080 30 fps, plus a 9:16 Shorts version at 1080×1920 (same timeline and music; the UI scenes use the app's phone layout, cards are re-laid out for portrait). A 480p draft is rendered first.

## Shot list

| Time (s) | Scene | What's on screen | Text |
|---|---|---|---|
| 0.00–1.02 | Cold open | Lemon sunburst, mascot 1 sitting still | "Got a picture?" |
| 1.02–3.69 | Hit | On the downbeat the mascot starts wiggling hard (Infinity) | "Make it WIGGLE!" |
| 3.69–6.36 | Title | Cover layout comes alive: WIGGLE / MY IMAGE / ANIMATOR slam in on beats 1, 2, 3; mascot wiggles on the right | title |
| 6.36–9.01 | App: drop | Light theme app. Cursor drags a picture in, "Drop it like it's hot" hint shows, drop on 7.69 → mascot 2 appears already wiggling | "Drop in a picture…" → "…it's already wiggling!" |
| 9.01–14.35 | Styles | One style per beat (8 beats = 2 bars): Infinity, Figure 8, Circle, Side-side, Up-down, Downhill, Uphill, Breathe. Rotating mascots and pastel backgrounds, path icon + name | "8 wiggle styles" + style name |
| 14.35–17.02 | App: sliders | Dark theme app. Cursor drags Wiggliness up, then Wander | "Tweak it" |
| 17.02–19.69 | App: surprise | Cursor clicks 🎲 Surprise me on three beats | "…or hit Surprise me!" |
| 19.69–22.36 | Backgrounds | One picture, background changes each beat: see-through, green screen, black, magenta; swatch row highlights | "See-through, green screen, any colour" |
| 22.36–25.03 | App: save | Light theme. Click Download GIF, progress bar fills, "Saved … 🎉" | "Save a looping GIF or video" |
| 25.03–27.70 | Wall | 3×2 grid (2×3 on Shorts) of all six mascots in different styles, popping in two per beat | "Memes · Emotes · Stickers" |
| 27.70–32.00 | End card | Cover layout: title, mascot wiggling, "Plays right in your browser", itch URL, "Made by Reactorcore". Music fades over the last bar, picture fades out in the last 0.5 s | end card |
