import { load } from "cheerio";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ImportError } from "./substack";
import { parsePublicationUrl, parseSubstackUrl } from "./substack-url";

export type FeedPost = { title: string; url: string; publishedAt: string };
export function parsePublicationFeed(xml: string, publicationUrl: string) {
  const publication = parsePublicationUrl(publicationUrl);
  if (
    xml.length > 2_000_000 ||
    /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    throw new ImportError("This feed couldn’t be read.");
  const parsed = new XMLParser({
    ignoreAttributes: true,
    processEntities: false,
  }).parse(xml);
  const channel = parsed?.rss?.channel;
  if (!channel || typeof channel.title !== "string")
    throw new ImportError("That link isn’t a publication feed.");
  const list = Array.isArray(channel.item)
    ? channel.item
    : channel.item
      ? [channel.item]
      : [];
  const seen = new Set<string>();
  const posts: FeedPost[] = [];
  for (const item of list.slice(0, 100)) {
    if (typeof item?.link !== "string" || typeof item?.title !== "string")
      continue;
    try {
      const source = parseSubstackUrl(item.link);
      const date = Date.parse(item.pubDate);
      if (
        source.host !== publication.host ||
        !Number.isFinite(date) ||
        date > Date.now() ||
        seen.has(source.url)
      )
        continue;
      seen.add(source.url);
      posts.push({
        title: load(item.title).text().slice(0, 180),
        url: source.url,
        publishedAt: new Date(date).toISOString(),
      });
    } catch {
      /* Ignore non-post and foreign links; they are never fetched. */
    }
  }
  posts.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return {
    title: load(channel.title).text().slice(0, 180),
    url: publication.url,
    posts: posts.slice(0, 20),
  };
}

export async function fetchPublicationFeed(value: string, request = fetch) {
  const source = parsePublicationUrl(value);
  const response = await request(source.feedUrl, {
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  });
  if (!response.ok || !response.body)
    throw new ImportError("We couldn’t open that publication’s feed.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2_000_000)
        throw new ImportError("This feed is too large to import.");
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return parsePublicationFeed(
    Buffer.concat(chunks).toString("utf8"),
    source.url,
  );
}

export function newFeedPosts(posts: FeedPost[], connectedAt: Date) {
  // RSS dates have second precision. Initial items are separately baselined, so
  // a newly discovered post in the same second as connection is not lost.
  return posts.filter(
    (post) =>
      Date.parse(post.publishedAt) >=
      Math.floor(connectedAt.getTime() / 1000) * 1000,
  );
}
