/**
 * Twitch embed URLs — no API key, no dev app.
 *
 * The `parent` parameter is the whole game: Twitch refuses to render the
 * player unless the hostname serving the page is listed. It's an EXACT
 * hostname match, so every origin the site is reachable from needs to be in
 * the list or the iframe comes back blank:
 *
 *   - production            theyolksters.netlify.app  (or the custom domain)
 *   - Netlify deploy preview  deploy-preview-12--theyolksters.netlify.app
 *   - local dev             localhost / 127.0.0.1
 *
 * Netlify sets URL to the primary origin and DEPLOY_PRIME_URL to the branch/
 * preview origin, so we read both rather than trusting Astro's `site` alone
 * (which is deliberately pinned to production for canonical URLs).
 */

function hostnameOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

export function embedParents(siteUrl: URL | undefined): string[] {
  const hosts = [
    siteUrl?.hostname,
    hostnameOf(process.env.URL),
    hostnameOf(process.env.DEPLOY_PRIME_URL),
    "localhost",
    "127.0.0.1",
  ].filter((h): h is string => Boolean(h));

  return [...new Set(hosts)];
}

/** Live player. Shows the stream when live, the channel's offline screen otherwise. */
export function playerUrl(channel: string, parents: string[]): string {
  const params = new URLSearchParams({
    channel,
    // Several players on one page — never autoplay, never blast audio.
    autoplay: "false",
    muted: "true",
  });
  for (const p of parents) params.append("parent", p);
  return `https://player.twitch.tv/?${params}`;
}

export const channelUrl = (channel: string) => `https://twitch.tv/${channel}`;

/** Twitch has no credential-free "latest VOD" — link to the archive instead. */
export const vodsUrl = (channel: string) =>
  `https://twitch.tv/${channel}/videos`;
