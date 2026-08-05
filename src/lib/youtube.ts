/**
 * Latest YouTube videos from the PUBLIC RSS feed — no API key, no quota.
 *
 * Two things worth knowing:
 *  1. This runs at BUILD time. The video list is only as fresh as the last
 *     deploy. (Browsers can't fetch this feed directly — YouTube sends no
 *     CORS headers — so client-side refresh isn't an option without a proxy.)
 *  2. It needs the channel ID ("UC..."), not the @handle.
 *
 * Never throws: a dead network or a bad ID yields an empty list so the build
 * still succeeds and the page just shows fewer videos.
 */

export interface YouTubeVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  published: Date;
}

const FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=";

/** XML/HTML entities that show up in real video titles. */
function decodeEntities(input: string): string {
  return input
    .replace(/&(?:#([0-9]+)|#x([0-9a-f]+));/gi, (_, dec, hex) =>
      String.fromCodePoint(parseInt(dec ?? hex, dec ? 10 : 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&"); // must be last, or it double-decodes
}

function firstMatch(block: string, re: RegExp): string {
  return re.exec(block)?.[1] ?? "";
}

export async function getLatestVideos(
  channelId: string,
  limit = 3,
): Promise<YouTubeVideo[]> {
  if (!channelId) return [];

  let xml: string;
  try {
    const res = await fetch(FEED + encodeURIComponent(channelId), {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(
        `[youtube] feed for ${channelId} returned ${res.status} — skipping.`,
      );
      return [];
    }
    xml = await res.text();
  } catch (err) {
    console.warn(`[youtube] could not fetch feed for ${channelId}:`, err);
    return [];
  }

  const videos: YouTubeVideo[] = [];

  for (const [entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = firstMatch(entry, /<yt:videoId>(.*?)<\/yt:videoId>/);
    const title = firstMatch(entry, /<title>([\s\S]*?)<\/title>/);
    const published = firstMatch(entry, /<published>(.*?)<\/published>/);
    const thumbnail = firstMatch(entry, /<media:thumbnail[^>]*url="([^"]+)"/);
    if (!id) continue;

    videos.push({
      id,
      title: decodeEntities(title.trim()),
      url: `https://www.youtube.com/watch?v=${id}`,
      // The feed's thumbnail is hqdefault; it's fine and always present.
      thumbnail: thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      published: new Date(published),
    });

    if (videos.length >= limit) break;
  }

  return videos;
}
