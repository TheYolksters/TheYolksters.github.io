/**
 * SITE SETTINGS — everything that's text or a link lives here.
 * Edit, save, done: the site rebuilds around these values.
 * (Colors live in src/styles/theme.css — or play at /theme.)
 */

export interface Social {
  label: string;
  href: string;
}

export interface NavItem {
  href: string;
  label: string;
}

export interface Member {
  /** used as URL-friendly id and to pick the avatar image */
  id: "grai" | "dia" | "kyle";
  name: string;
  role: string;
  blurb: string;
  /**
   * Twitch channel name ONLY — e.g. "thegrai".
   * No slashes, no URL, no leading @. A trailing slash silently breaks the
   * embed player (player.twitch.tv/?channel=thegrai/ returns nothing).
   * Leave "" until known.
   */
  twitch: string;
  /** YouTube handle for the profile link, e.g. "@thegrai" — leave "" until known */
  youtube: string;
  /**
   * YouTube channel ID — the "UC..." string, NOT the @handle. Required for the
   * Watch page's video list, which reads the public RSS feed at build time.
   * Find it at youtube.com → channel page → Share → Copy channel ID.
   * Leave "" and that member is simply skipped on Watch.
   */
  youtubeChannelId: string;
}

/** A Twitch channel two or more members stream on together. */
export interface SharedStream {
  name: string;
  /** shown under the name on Watch, in the same spot as a member's role */
  role: string;
  /** Twitch channel name ONLY — same rules as Member.twitch above */
  twitch: string;
}

/**
 * Main navigation — the ONLY place nav links are defined.
 * Both the desktop bar and the mobile sheet menu read from this.
 */
export const nav: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/about/", label: "About" },
  { href: "/roster/", label: "Roster" },
  { href: "/watch/", label: "Watch" },
];

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
      id: "dia",
      name: "DarlingDia",
      role: "The High-Vibe Anchor",
      blurb:
        "Dia is the life of the flock, bringing infectious humor and positive vibes that keep team morale sky-high no matter the score. But don't let the jokes fool you—when the pressure peaks and the Cashout timer is ticking down, she becomes an absolute game-changer. Dia is an unstoppable clutch machine who single-handedly turns chaotic firefights around, locks down the objective completely, and serves as the dominant backbone of the entire roster.",
      twitch: "darling_dia",
      youtube: "",
      youtubeChannelId: "",
    },
    {
      id: "grai",
      name: "TheGrai",
      role: "The Architect",
      blurb:
        "Grai is the flocks’s technical specialist and ultimate flex player. Driven by adaptability over ego, he gladly fills whatever role, build, or gadget loadout the match demands—seamlessly pivoting between heavy utility, support, or aggressive setups to complete the team comp. Whether re-tooling mid-match to counter high-tier enemy strategies or optimizing destruction angles, his deep understanding of game mechanics keeps the lineup flexible and ready for any chaotic arena matchup.",
      twitch: "thegrai",
      youtube: "",
      youtubeChannelId: "",
    },
    {
      id: "kyle",
      name: "KoalaKyle",
      role: "The Wildcard",
      blurb:
        "As the flock's resident chaos engine, Kyle’s sheer unpredictability is his greatest weapon. Always in high spirits and permanently ready to hit the W-key and push, his relentless aggression turns quiet standoffs into absolute arena spectacle. Whether busting through walls to blow open sightlines or plunging headfirst into contested Cashouts, Kyle disrupts enemy setups before they even know what hit them—keeping the squad's momentum rolling at full speed.",
      twitch: "koalakyle02",
      youtube: "",
      youtubeChannelId: "",
    },
  ] as Member[],

  /** Channels members run together — each gets its own player on Watch. */
  sharedStreams: [
    {
      name: "DiaAndGrai",
      role: "The Double Yolk",
      twitch: "diaandgrai",
    },
  ] as SharedStream[],
};
