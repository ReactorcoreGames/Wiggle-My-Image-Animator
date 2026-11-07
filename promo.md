# Wiggle My Image Animator — Promo notes (internal, not shipped)

## Strategy

### What it is, in one breath

A tiny, instant, no-sign-up browser toy: drop a picture, it wiggles, save a looping GIF. The hook is speed and silliness: from "huh" to a shareable GIF in about ten seconds. The output itself is the marketing, because every GIF someone posts is a little advert for the toy.

### Who it's for

- Meme makers and group-chat people who want a reaction GIF of their pet, friend or face.
- Streamers, VTubers and Discord server owners making animated emotes, stickers and alerts (the see-through and green-screen backgrounds matter here).
- Pixel artists and game devs who want a quick wobbly effect for a sprite or logo.
- Kids, teachers and casual users looking for "make picture move" / "gif maker online" tools.

### Honest take on the business model

This is a small one-trick toy in a space full of free alternatives (ezgif-style GIF sites, meme generators, phone apps). People searching for this kind of thing expect it to be free and instant, so a paid price would likely get very few sales and would block the sharing loop that is its main value. Its best value to you is traffic: as a free (or name-your-own-price with a zero minimum, so people can tip) itch.io browser toy, it can bring in steady search traffic and point people to your other work, Patreon and Discord. It is MIT-licensed, so putting it on GitHub as well is a cheap extra: GitHub search and your catalog page give it a second persistent home, and the code is small and readable, which suits "remix this" visitors. The final call on free, tips or paid is yours.

### Tactics

- Lead every listing with the demo GIFs (`gifs/demo.gif`, plus `gifs/demo_<style>.gif`, one per wiggle style on pastel backgrounds), not a static screenshot. Motion sells this toy.
- On itch.io, upload it as a playable HTML game (use the `_itch-web.zip`, see `build_release.bat`), set the embed size so the full app fits (around 1280×860 for desktop; tick "Mobile friendly" and set orientation to "Default"), and also offer the full zip as a download for offline use.
- Use the 8 style demo GIFs as itch.io screenshots (itch shows GIFs animated), and later add a few made with other recognisable, safe subjects (a cat, a dog, a pixel-art sprite).
- Pin a short "how I made this" post in your Discord and Patreon with a few GIFs, so existing followers share it.
- Ask people to post their wiggles in the itch.io comments. User GIFs in the comments are social proof that keeps working long after launch.
- The YouTube trailer has a Shorts cut (`trailer/trailer_shorts.mp4`); GIF tools do well in Shorts because the result is instantly visible.
- Keep the itch.io tags aimed at what people search for: "gif", "meme", "animation", "image editor".

### Hashtags

#GIF #GIFMaker #Meme #MemeMaker #Animation #PixelArt #WebToy #itchio #IndieDev #Emote

## Copypastas

### itch.io

**Name of project**

Wiggle My Image Animator

**Subtitle (≤100 characters)**

Drop in any picture and watch it wiggle. Save it as a looping GIF or video and share it!

**Long description (markdown)**

```markdown
# Wiggle My Image Animator

This is a webapp to create goofy animations from any image - preferably a PNG with transparent background.

I built it just for fun, because why not.

## Make any picture wiggle! 🍋

Drop in a picture and it starts wobbling, twisting and breathing like jelly. Pick a style, tweak a few sliders, and save it as a **GIF that loops forever**, or as a short **video**. Perfect for reaction GIFs, memes, emotes, stickers and silly group-chat moments.

No sign-up, no install, no uploads: everything happens right in your browser and **your pictures never leave your device**.

## How it works

1. **Drop, paste or pick** any picture (PNG, JPG, WebP, GIF…).
2. **Choose a wiggle style**: Infinity, Figure 8, Circle, Side-side, Up-down, Downhill, Uphill or Breathe.
3. **Tweak it** with three friendly sliders: *Wiggliness*, *Wander* and *Speed*. Or smash 🎲 **Surprise me**.
4. **Save it** as a looping GIF or a video, in Small, Medium or Large. On phones, **Share** sends it straight to your apps.

## Features

- 8 seamless looping wiggle styles
- **Stay in frame**: auto-zoom so nothing wiggles off the edge
- Backgrounds: see-through, white, black, **green screen**, magenta or any colour you like
- See-through GIFs for stickers and emotes
- Reverse, show the path, and hold the picture to peek at the original
- Pixel art stays crisp
- Light and dark mode, works on phones and computers
- Download the zip to use it **offline**: just open `index.html`

Play it here: https://reactorcore.itch.io/wiggle-my-image-animator

Made by Reactorcore 🍋 — check out my other stuff: https://linktr.ee/reactorcore
```

**10 tags (comma separated)**

gif, animation, meme, image-editor, funny, photo, tool, html5, effects, emotes

### GitHub (About box)

**Description blurb**

Drop in any picture and watch it wiggle, then save it as a looping GIF or video. A tiny plain HTML/JS web toy (WebGL swirl via glfx.js, GIFs via gifenc) that runs offline from file://.

**10 topics (1 per line)**

gif
gif-maker
image-animation
webgl
glfx
javascript
html5
meme-generator
web-toy
browser-tool

### YouTube (trailer / showcase)

Files: `trailer/trailer.mp4` (16:9, 1920×1080, 32 s) and `trailer/trailer_shorts.mp4` (9:16, 1080×1920, 32 s). Both are rendered by `testing/trailer.js`; plan in `trailer/trailer.md`. Music: "Cafecito por la Mañana" by Cumbia Deli (YouTube Audio Library, no attribution required; YouTube may add its own credit).

**Video title**

Wiggle My Image Animator — Make Any Picture Wiggle and Save It as a GIF 🍋

**Video description**

```
Drop in any picture and watch it wiggle! Wiggle My Image Animator is a tiny browser toy that turns any picture into a wobbly, looping GIF or video in seconds. Pick from 8 wiggle styles, tweak Wiggliness, Wander and Speed (or hit Surprise me), choose a background (see-through and green screen included), and save. No sign-up, no install, and your pictures never leave your device. Great for memes, emotes, stickers and group chats.

▶ Try it: https://reactorcore.itch.io/wiggle-my-image-animator

Music: "Cafecito por la Mañana" by Cumbia Deli (YouTube Audio Library)

Check out everything else I do: ✨🚀
https://linktr.ee/reactorcore
https://reactorcore.itch.io/

My other links:
Home/Links: https://linktr.ee/reactorcore
Releases: https://reactorcore.itch.io
Blog: https://www.patreon.com/ReactorcoreGames
Discord: https://discord.gg/UdRavGhj47
Catalog: https://reactorcoregames.github.io/

Contact: reactorcoregames@gmail.com

-Reactorcore
```

**Video tags (comma separated)**

gif maker, wiggle effect, image animator, make picture move, animated gif, online gif maker, meme maker, emote maker, sticker maker, green screen gif, transparent gif, swirl effect, browser tool, web app, itch.io

**Shorts title** (keep it under ~60 characters; #Shorts is optional, the 9:16 shape is what counts)

Make any picture WIGGLE 🍋 #shorts

**Shorts description**

```
Drop in a picture, it wiggles, save a looping GIF or video. Right in your browser.
▶ https://reactorcore.itch.io/wiggle-my-image-animator
#gif #meme #animation #webtoy
```

## Marketing targets (persistent places)

1. **itch.io itself** — the main home. Browser toys are found through tag pages (`gif`, `meme`, `animation`) and the "Tools" section. Also post once in the itch.io community forum "Release Announcements" board; forum threads stay up and get indexed.
2. **AlternativeTo (alternativeto.net)** — list it as an alternative to popular online GIF makers and meme tools. Listings are permanent and rank well in search.
3. **GitHub** — if you open-source it, a repo with the demo GIF at the top of the readme, the topics above, and an entry on your catalog page (reactorcoregames.github.io). Small "awesome" lists of web toys / creative coding accept pull requests and are browsed for years.
4. **Product Hunt** — a launch page is a permanent listing with a backlink. Small tools like this do best launched as a "fun side project".
5. **Reddit's r/InternetIsBeautiful** — known for exactly this kind of single-purpose web toy; posts need a direct link to the working site (the itch.io page counts). I couldn't check the subreddit's current activity or rules, so read the sidebar first.
