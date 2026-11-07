# RC Final prep prompt before launch

This doc/prompt is meant for after the project has reached a functional clean state that is worthy of releasing online as a downloadable zip file.

## Prompt

### Phase 1 - Create materials

I need a standard set of auxiliary deliverables for the public release of my project, placed into the project root folder:
- guide.md (how to use the contents of the package, try to keep it short - if you can't then have a TL;DR/quickstart at the top to compensate for it.)
- promo.md (copypastas, marketing location hints/strategies/tactics/hashtags, + honest estimate if the project's business model should be free, paid, or paid + open source, or use some other model that benefits the author in terms of traffic or revenue or both)
- readme.md (general layman info about the project. would include any license stuff plus my links* (see below))
- promo/ (a folder contains 1-5 or more screenshots (16:9) + a 630x500px itch io thumbnail and a 1280x720px cover image, both of those images featuring big font sizes only, as much as dense visual detail as possible. You can create all of these mentioned materials with whatever methods you think will work best tailored for this project, resulting in PNG/JPG (depending on which will result in a smaller more efficient filesize))

### Phase 2 - Create release zip/dist

After those are done, I'll want a build_release.bat that would take the existing project materials to create/compile a ready-to-send .zip release package with the type of structure seen below:

(project root folder)
- dist
-- project_name (release's "root" folder that will be zipped)
--- (any project materials go here, with subfolders if they're necessary - for less than 10 project-specific files the structure can be kept flat)
--- promo/ (a folder contains 1-5 or more screenshots + a 630x500px itch io thumbnail and a 1280x720px cover image, latter both featuring big font sizes only, as much as dense visual detail as possible. Claude can create all of these mentioned materials with whatever tools it has at its disposal, resulting in PNG/JPG (depending on which will result in a smaller more efficient filesize))
--- guide.md
--- promo.md (actually omit this from the release zip - its meant as an internal document after all.)
--- readme.md

#### Rules for writing docs
- Do NOT artificially do wordwrap lines yourself. It makes copy pasting text infuriating because I keep needing to fix the lines afterwards. Just let them be full without newlining them after some arbitrary lenght.
- For the promo.md doc, first write the marketing strategy/tactics/locations/ideas stuff first, then give me easy copypastas for:
-- itch.io
--- Name of project
--- 100 character long subtitle
--- long description in markdown
--- 10 tags, comma separated
-- github (the top right info box thing)
--- description blurb
--- 10 tags, 1 per line, no formatting
-- youtube video (general trailer, showcase, etc - only write this if its applicable to project, otherwise skip)
--- youtube video title
--- youtube video description + my links
--- youtube video tags (comma separated)
-- hints for marketing targets I could look into - upto 5 places, be it websites, youtubers, or portals. Skip if not applicable. You cannot access reddit because they blocked AI/bots, so anything else but that, unless you can atleast gleam from a web search for subreddit titles+description, if its active or not, then sure fine. Generally keep it simple, since I have a whole different project where I will do actual marketing in.
-- generally I want to post my projects into persistent places where people will organically find them while they browse/look for what they want or think what they know what the want.
-- generally never assume pricing, especially any specific sums or amounts. I usually decide if a thing is gonna be free, open source, paid or tiered - and the price might start initially small for early users but increase later once more established.

### Phase 3 - Project folder cleanup for cleaner future maintenance

Any other wip materials, wip documents or non-critical files that are now-useless artifacts should all be relocated to a "old wip" folder.
Create a .gitignore file that ignores that "old wip" folder, but also ignores other ignore-worthy stuff that shouldn't end up in a github repo, like pycache stuff, dist folder, .claude folder or anything else that simply doesn't belong in the github repo.
Recheck and rewrite claude.md - and if present, other similar files like memory.md or decisions.md or whatever like that so that the project will be better optimized for future maintenance operations without the old development data that might be more of a hassle/burden/useless for the purposes of new feature developments and changes/remixes.


## Potential ideas of the thumbnail & cover image in promo:
1. If a project is a software program that uses an .ico file, I might already make this folder and place a icon_og.png inside, which is usually a large original 1024x1024px image that was used to create the smaller .ico file. It could be useful as the background art upon which large font title and other info also in a somewhat large font would be drawn over an suitable position over said image as a top layer, with a strong text shadow to make the text stand out from the background elements.
2. If the project has a nice screenshot or a detailed collage image of its content/catalog, they can be used instead of the icon_og.png.
3. If neither is suitable, then another idea is colorful artsy text that fits the vibe of the project, sort of like a loud product/service advertisement poster style.

## *Links info for readme.md & guide.md

<links>
## Contact

mailto:reactorcoregames@gmail.com

---

Check out everything else I do: ✨🚀

https://linktr.ee/reactorcore

https://reactorcore.itch.io/

-Reactorcore

---

My other links:
Home/Links: https://linktr.ee/reactorcore
Releases: https://reactorcore.itch.io
Blog: https://www.patreon.com/ReactorcoreGames
Discord: https://discord.gg/UdRavGhj47
Catalog: https://reactorcoregames.github.io/
</links>

### Footer or Branding (if the project is suitable for it and doesn't already have it)

Made by Reactorcore - https://linktr.ee/reactorcore

(Can be in any format or style or structure or wording. For software, usually theres one branding element always visible but fairly subtle - either near the title or the bottom footer.)