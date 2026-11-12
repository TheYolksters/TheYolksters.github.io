# The Yolksters [Ch1kn] — Team Website

The official site for **The Yolksters**, a family-friendly esports squad.
Static [Astro 7](https://astro.build) site with React islands, Tailwind CSS 4,
and shadcn-style components, deployed on Netlify.

> Roadmap, architecture decisions, and phase planning live in [PLAN.md](PLAN.md).

## Develop

### With Docker (no local Node needed)

```bash
docker compose up            # first run builds the image
# → http://localhost:4321        (theme playground at /theme, Yolkster Creator at /creator)
```

Edit files normally — hot reload works through the bind mount (the container
polls for changes, since file events don't cross the Windows→Linux boundary).

- **Changed `package.json`?** Rebuild and refresh the dependency volume:
  `docker compose down -v && docker compose up --build`
- **Preview the production build:**
  `docker compose --profile preview up --build preview` → http://localhost:4322
- VS Code users: "Reopen in Container" works via [.devcontainer/](.devcontainer/).

### With local Node (24+)

```bash
npm install
npm run dev                  # → http://localhost:4321
npm run build                # production build to dist/
npm run preview              # serve dist/ locally
```

## Everyday edits

| I want to… | Edit |
| --- | --- |
| Change brand colors | [src/styles/theme.css](src/styles/theme.css) — or play at `/theme` first, then Copy CSS |
| Change names, blurbs, socials, channels | [src/config/site.ts](src/config/site.ts) |
| Change page copy | [src/pages/](src/pages/) |
| Swap art | Hero/banner/crest PNGs go in [Images/TheYolksters/](Images/TheYolksters/); `-clean` character art + wordmark go at [Images/](Images/) root (filenames are hard-coded in [scripts/prep-images.mjs](scripts/prep-images.mjs) — update them there). Then run `node scripts/prep-images.mjs` |
| Add a pose, outfit, colour or scene to the Creator | [src/config/creator.ts](src/config/creator.ts) |
| Make new character art (new pose, new outfit) | Open `/creator` — see below |

Images are optimized automatically at build time (WebP, responsive sizes) —
commit the PNGs, Astro does the rest.

## Yolkster Creator (`/creator`)

An unlinked tool page, like `/theme`: pose a chick doll, pick an outfit, and
hand the result to an image AI to draw the real thing.

1. **Who** — pick DarlingDia, TheGrai or KoalaKyle (or upload someone new).
2. **Pose** — start from a preset, then drag the dots on the doll. Rest the
   pointer on a dot (or click it) for its quick options, such as hand shapes
   and faces; **right-click** it for all of them (press and hold on a phone).
   The selected dot grows a red and a green arrow that slide it one way only,
   and a blue ring that turns it.
3. **Outfit** — change pieces one by one, or leave them "As in the art".
4. **Shot** — roster art, a cutout, an emote or a full scene.
5. **Send** — three things to paste into the Gemini app or ChatGPT: the real
   character art, a pose guide and a ready-written prompt.
6. **Finish** — drop the AI's picture back in to get a transparent cutout, or
   a square white `-clean` file named for [Images/](Images/).

Good to know:

- **Nothing is uploaded by the site.** It has no server. Pictures leave your
  computer only when you paste them into the AI yourself.
- **Your design autosaves in the browser**, and Send has a "copy link" button
  that packs the pose and outfit into a link for a teammate.
- **The prompt quotes each character's exact colours.** They were measured
  from the art and are written down per character in
  [src/config/creator.ts](src/config/creator.ts) (`palette`, the pet's `fur`,
  and each picture's `colors`). If art is re-exported with different colours,
  read the new codes off it with any colour picker and update them there.
  Image AIs brighten colours a little every time they redraw their own
  picture, so after two or three replies start a new chat from the original
  art. Send also has a ready-made "The colours drifted" reply.
- **The dashed box on the doll is a stand-in** for whatever is being held. It
  is labelled with the item's name, can be dragged anywhere, and the AI draws
  the real thing in its place.
- **API keys are optional and for later.** Send has a collapsed section that
  can call Gemini or OpenAI directly with your own key. The key stays in that
  browser. That path was written from the providers' API guides and has not
  been run against a live key yet, so expect to fix a wrinkle on first use —
  the adapters live in one file, [src/lib/creator/providers.ts](src/lib/creator/providers.ts).
- **The character art comes straight from [Images/](Images/)** (the same
  `-clean` files `prep-images.mjs` reads), so re-exported art shows up in the
  Creator on the next build. If a file is renamed, update the imports at the
  top of [src/pages/creator.astro](src/pages/creator.astro).

| I want to… | Edit |
| --- | --- |
| Add or tweak a pose, outfit preset, wardrobe item, colour swatch or scene | [src/config/creator.ts](src/config/creator.ts) |
| Add or reword a ready-made face, or rename a hand shape | `EXPRESSIONS` and `HANDS` in [src/config/creator.ts](src/config/creator.ts) |
| Update a character's colour codes | `palette`, `fur` and `colors` in `CHARACTERS` in [src/config/creator.ts](src/config/creator.ts) |
| Change how the prompt is worded | [src/lib/creator/prompt.ts](src/lib/creator/prompt.ts) |
| Change how the doll (hands and faces included) is drawn | [src/components/creator/Doll.tsx](src/components/creator/Doll.tsx) |
| Change what a dot's options card offers | [src/components/creator/NodeCard.tsx](src/components/creator/NodeCard.tsx) |
| Add a new team member to the Creator | their entry in `CHARACTERS` in [src/config/creator.ts](src/config/creator.ts) + the imports in [src/pages/creator.astro](src/pages/creator.astro) |

## Deploy (Netlify)

Connect the repo to a Netlify site; [netlify.toml](netlify.toml) has the build
config and cache headers. Canonical/OG URLs pick up the real site URL from
Netlify's `URL` env var automatically.

⚠️ The free plan is credit-based: **each production deploy costs 15 of the
monthly 300 credits.** Batch changes and merge deliberately — branch deploys
and previews are free.
