# The Yolksters [Ch1kn] — Website Plan

> **Status: DRAFT v2 — awaiting confirmation.** Once we agree on this plan, it becomes the build checklist and we replace/augment it with a proper README.
>
> **v2 changes:** Netlify account confirmed as new credit-based free tier · Twitch API/dev-app deferred (v1 uses credential-free embeds) · added the site settings + brand color system.

A family-friendly esports team site for **The Yolksters**, deployed on a free Netlify account. Fully static in v1 — no API keys, no serverless functions — with a clean upgrade path to real-time live badges later.

---

## 1. Pages & Features (v1 scope)

| Page | Content |
| --- | --- |
| **Home** | Hero with team crest/banner, tagline, links into the rest of the site |
| **About Us** | Migrated from the existing [AboutUs.md](AboutUs.md) ("Welcome to the Coop", vibe & vision) |
| **Roster** | Card per member (TheGrai, DarlingDia, KoalaKyle) using the individual chicken art — role, blurb, stream/social links |
| **Streams** | **Embedded Twitch players** (no API needed — they show the live stream automatically when a member is broadcasting), latest YouTube videos via free RSS, channel links |
| **News** | Markdown-based posts (announcements, recaps) via Astro content collections |
| **Footer (all pages)** | Socials/contact links: Discord, X/Twitter, TikTok, YouTube, Twitch, etc. |
| **`/theme` (unlinked)** | Brand/theme preview playground — see §4 |

**Deferred (not in v1):** real-time LIVE badges via Twitch API (see §3), match schedule/results, merch/sponsors, CMS for non-technical editing.

---

## 2. Tech Stack

Verified current as of August 2026:

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | **Astro 7** (7.1.x) | Static output; ships zero JS except where we opt in |
| Interactive UI | **React 19 + TypeScript** islands | v1 needs very little browser JS (theme playground, maybe a mobile nav) |
| Styling | **Tailwind CSS 4** via `@tailwindcss/vite` | CSS-first config (`@theme` block, no `tailwind.config.js`) |
| Components | **shadcn/ui** (stable CLI, official Astro template) | Ready-made cards, badges, buttons, nav — themed via CSS variables (which is exactly what makes §4's color settings work) |
| Images | **`astro:assets` built-in** | WebP generated automatically at build time; AVIF is a one-line opt-in. No custom pipeline needed. |
| Hosting | **Netlify** (credit-based free plan — confirmed) | Static hosting only in v1 |
| Backend | **None in v1** | The live-status serverless function is designed (§3) but deferred until we want real LIVE badges |

### Setup commands (verified current)

```bash
npm create astro@latest
npx astro add react
npx astro add tailwind        # wires up @tailwindcss/vite (Tailwind v4)
npx shadcn@latest init -t astro
npx shadcn@latest add card badge button navigation-menu
```

Gotchas already scouted so we don't trip on them:

- **Don't** use `@astrojs/tailwind` (deprecated, Tailwind v3 only) — old tutorials will suggest it.
- **Don't** add the `@astrojs/netlify` adapter — the site is fully static. Adding it would silently move image optimization from build-time to Netlify's Image CDN.
- shadcn needs `"@/*": ["./src/*"]` path aliases in `tsconfig.json` (Astro doesn't add these by default).
- Astro 7's compiler drops whitespace-only text nodes containing a newline: when text and an inline tag are split across lines, the space between them vanishes ("We areThe Yolksters"). Keep the space on the same line as the tag, or use an explicit `{" "}`. (Hit this for real during Phase 1.)
- shadcn components in Astro are React islands — interactive ones need `client:load`/`client:visible`.

---

## 3. Streaming — v1 (no credentials) and the deferred upgrade

### v1: zero-API approach

- **Twitch embeds on the Streams page.** The standard iframe player (`player.twitch.tv/?channel=NAME&parent=OUR-DOMAIN`) needs no API key or dev app. When a member is live it plays their stream; otherwise it shows their offline screen. The `parent` parameter just lists our domain(s) — the `*.netlify.app` subdomain now, custom domain later.
- **Latest YouTube videos at build time** from the public RSS feed (`youtube.com/feeds/videos.xml?channel_id=...`) — no API key, no quota. Refreshes on each deploy; fine for v1.
- Everywhere else (roster cards, footer): plain channel links.

### Deferred: real LIVE badges (the researched design, kept for later)

When we're ready to add "🔴 TheGrai is live" badges site-wide, this is the already-verified architecture — it needs a free Twitch dev app (2FA required) and two Netlify env vars, which is exactly the setup we're bypassing for now:

```text
Browser (LiveStatus island, polls every 60s)
   │  GET /api/live-status                    (same origin — no CORS)
   ▼
Netlify Function: netlify/functions/live-status.mts
   │  Cache-Control: public, s-maxage=60, stale-while-revalidate=300
   │  → CDN collapses ALL visitors into ~1 upstream call per minute
   ├──► Twitch Helix: GET /helix/streams?user_login=a&user_login=b...
   │      one request checks every member; app token lives ~58 days
   └──► YouTube: fetch youtube.com/@handle/live, check "isLiveNow":true (zero quota)
```

Nothing in v1 blocks this — it's purely additive (one function file + one React island + two env vars).

---

## 4. Site Settings & Brand Theming ("website settings")

No database on a static site, so "settings" = **two small, human-editable files** that control the whole site. Change a value, commit, done.

### `src/config/site.ts` — everything that's text or a link

```ts
export const site = {
  name: "The Yolksters",
  tag: "[Ch1kn]",
  tagline: "Rule the roost.",
  socials: { discord: "...", twitter: "...", tiktok: "..." },
  members: [
    { name: "TheGrai", role: "The Architect", twitch: "...", youtube: "..." },
    // ...
  ],
};
```

### `src/styles/theme.css` — the brand colors, one place

Tailwind 4 and shadcn/ui are both driven by CSS variables, so the entire site retints from a handful of values:

```css
@theme {
  --color-brand:        #f5a623;  /* primary — yolk gold        */
  --color-brand-accent: #7b3ff2;  /* accent — space purple      */
  --color-brand-dark:   #14121f;  /* backgrounds — cosmos       */
  /* shadcn tokens (--primary, --background, …) map onto these */
}
```

Change `--color-brand`, and every button, badge, link, and highlight follows. (Placeholder hexes above — real values get pulled from the crest artwork during Phase 1, unless you have official ones.)

### `/theme` — live preview playground (unlinked page)

A page showing the full palette, typography, and sample components (roster card, buttons, badges) **with in-browser color pickers**: tweak colors and watch the whole page restyle instantly. It can't save (static site), but you experiment visually, then copy the winning hex values into `theme.css`. This is the "settings page" experience without needing a backend.

---

## 5. Content Model & Project Structure

All content lives in the repo (git is the CMS — fine for a 3-person team):

```text
src/
  config/site.ts       ← site settings (§4)
  styles/theme.css     ← brand colors (§4)
  content/news/        *.md posts (title, date, image in frontmatter)
  pages/               index, about, roster, streams, news, theme
  components/          shadcn components + site components
  assets/              optimized copies of Images/TheYolksters/*
```

Existing `AboutUs.md` content moves into the About page; existing `Images/` become `src/assets/` sources so Astro optimizes them (several PNGs there will shrink dramatically as WebP).

---

## 6. ⚠️ Netlify Free Plan — Deploy Budget (confirmed: credit-based)

Your account is on the new credit-based free tier, so this is our operating reality:

- **300 credits/month, hard stop** — when credits run out, the site *pauses* until next month. No overage billing.
- **Each production deploy costs 15 credits** → ~20 deploys/month absolute ceiling; realistically budget **~15/month (roughly 3–4 per week)** leaving room for bandwidth (20 credits/GB).
- **Deploy previews and branch deploys are free** — only production deploys are metered.
- v1 being fully static helps: zero function compute, and WebP-optimized images keep bandwidth credits stretched.

**Working style this implies:** develop locally (`npm run dev`), push feature branches for free previews, and merge to `main` (production deploy) deliberately rather than on every small tweak.

*Fallback if credits ever pinch: Cloudflare Pages' free tier (unlimited static requests) is a low-friction migration for this architecture. Not proposing it now — just noting the exit exists.*

*Also noting: the repo is named `TheYolksters.github.io` (GitHub Pages convention). Harmless on Netlify; rename or don't — nothing depends on it.*

---

## 7. Build Phases

**Phase 1 — Skeleton, theme system & core pages**
Scaffold Astro 7 + React + Tailwind 4 + shadcn. Build the settings system (§4): `site.ts`, `theme.css` with colors pulled from the crest art, and the `/theme` playground. Layout, nav, footer with socials. Home, About Us, Roster pages from existing content/images. First deploy to Netlify.

**Phase 2 — Streams & news**
Streams page with Twitch embeds + latest YouTube videos (build-time RSS — just needs channel IDs, no keys). News content collection + a first post. SEO/meta/OpenGraph (using `TheYolksters_Banner_GenSocials.png`), favicon, 404 page, Lighthouse pass.

**Phase 3 — Real live status (whenever you're ready, fully optional)**
Twitch dev app + env vars, the `live-status.mts` function, LIVE badges on roster cards + Home banner. The §3 design means this bolts on without touching anything built earlier.

Each phase ends deployed and working — the site is useful after Phase 1 even if later phases wait.

---

## 8. What I need from you before/during the build

| Item | Needed for | When |
| --- | --- | --- |
| Confirm this plan (edit anything!) | everything | now |
| Brand color preferences (or I'll extract from the crest and you tune via `/theme`) | theming | Phase 1 |
| Discord/social links for the footer | footer | Phase 1 |
| Twitch channel names for each member | embeds + links | Phase 2 |
| YouTube handles / channel IDs | videos + links | Phase 2 |
| Custom domain? (e.g. theyolksters.gg) | DNS setup | optional, any time |
| Twitch dev app credentials | LIVE badges | only if/when we do Phase 3 |

---

## 9. Open questions (non-blocking)

- Which game(s) does the team compete in? Worth naming on Home/About for SEO.
- Should the news section support multiple authors (one md field) or keep it simple?
- Any interest later in a match schedule page? (Deliberately out of v1.)
