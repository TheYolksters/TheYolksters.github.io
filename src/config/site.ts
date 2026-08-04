/**
 * SITE SETTINGS — everything that's text or a link lives here.
 * Edit, save, done: the site rebuilds around these values.
 * (Colors live in src/styles/theme.css — or play at /theme.)
 */

export interface Social {
  label: string;
  href: string;
}

export interface Member {
  /** used as URL-friendly id and to pick the avatar image */
  id: "grai" | "dia" | "kyle";
  name: string;
  role: string;
  blurb: string;
  /** Twitch channel name, e.g. "thegrai" — leave "" until known (Phase 2) */
  twitch: string;
  /** YouTube handle, e.g. "@thegrai" — leave "" until known (Phase 2) */
  youtube: string;
}

export const site = {
  name: "The Yolksters",
  tag: "[Ch1kn]",
  tagline: "Rule the roost.",
  description:
    "The Yolksters [Ch1kn] — a family-friendly esports squad built on high-tier gameplay, undeniable chemistry, and just enough chaos to keep opponents scrambling.",

  /** Add real links as they come online — empty list just hides the icons. */
  socials: [
    // { label: "Discord", href: "https://discord.gg/..." },
    // { label: "X / Twitter", href: "https://x.com/..." },
    // { label: "TikTok", href: "https://tiktok.com/@..." },
    // { label: "YouTube", href: "https://youtube.com/@..." },
    // { label: "Twitch", href: "https://twitch.tv/..." },
  ] as Social[],

  members: [
    {
      id: "grai",
      name: "TheGrai",
      role: "The Architect",
      blurb:
        "The technical engine of the coop. Grai thrives on analyzing the meta, crunching the data, and fine-tuning the team's approach — the exact technical foundation the flock needs to execute.",
      twitch: "",
      youtube: "",
    },
    {
      id: "dia",
      name: "DarlingDia",
      role: "The Heart & The Muscle",
      blurb:
        "Dia brings the funny, positive vibes that keep morale high no matter the score. But don't let the jokes fool you — when the pressure is on, she's the powerhouse who locks the map down.",
      twitch: "",
      youtube: "",
    },
    {
      id: "kyle",
      name: "KoalaKyle",
      role: "The Wildcard",
      blurb:
        "The newest recruit, and unpredictability is his greatest weapon. Always in good spirits and permanently ready to hit the W-key, his relentless energy keeps the enemy guessing.",
      twitch: "",
      youtube: "",
    },
  ] as Member[],
};
