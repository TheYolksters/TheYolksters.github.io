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
      id: "dia",
      name: "DarlingDia",
      role: "The High-Vibe Anchor",
      blurb:
        "Dia is the life of the flock, bringing infectious humor and positive vibes that keep team morale sky-high no matter the score. But don't let the jokes fool you—when the pressure peaks and the Cashout timer is ticking down, she becomes an absolute game-changer. Dia is an unstoppable clutch machine who single-handedly turns chaotic firefights around, locks down the objective completely, and serves as the dominant backbone of the entire roster.",
      twitch: "darling_dia/",
      youtube: "",
    },
    {
      id: "grai",
      name: "TheGrai",
      role: "The Architect",
      blurb:
        "Grai is the flocks’s technical specialist and ultimate flex player. Driven by adaptability over ego, he gladly fills whatever role, build, or gadget loadout the match demands—seamlessly pivoting between heavy utility, support, or aggressive setups to complete the team comp. Whether re-tooling mid-match to counter high-tier enemy strategies or optimizing destruction angles, his deep understanding of game mechanics keeps the lineup flexible and ready for any chaotic arena matchup.",
      twitch: "thegrai/",
      youtube: "",
    },
    {
      id: "kyle",
      name: "KoalaKyle",
      role: "The Wildcard",
      blurb:
        "As the flock's resident chaos engine, Kyle’s sheer unpredictability is his greatest weapon. Always in high spirits and permanently ready to hit the W-key and push, his relentless aggression turns quiet standoffs into absolute arena spectacle. Whether busting through walls to blow open sightlines or plunging headfirst into contested Cashouts, Kyle disrupts enemy setups before they even know what hit them—keeping the squad's momentum rolling at full speed.",
      twitch: "",
      youtube: "",
    },
  ] as Member[],
};
