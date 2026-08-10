# The Yolksters [Ch1kn] — Team Website

The official site for **The Yolksters**, a family-friendly esports squad.
Static [Astro 7](https://astro.build) site with React islands, Tailwind CSS 4,
and shadcn-style components, deployed on Netlify.

> Roadmap, architecture decisions, and phase planning live in [PLAN.md](PLAN.md).

## Develop

### With Docker (no local Node needed)

```bash
docker compose up            # first run builds the image
# → http://localhost:4321        (theme playground at /theme)
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

Images are optimized automatically at build time (WebP, responsive sizes) —
commit the PNGs, Astro does the rest.

## Deploy (Netlify)

Connect the repo to a Netlify site; [netlify.toml](netlify.toml) has the build
config and cache headers. Canonical/OG URLs pick up the real site URL from
Netlify's `URL` env var automatically.

⚠️ The free plan is credit-based: **each production deploy costs 15 of the
monthly 300 credits.** Batch changes and merge deliberately — branch deploys
and previews are free.
