import assert from "node:assert/strict";
import test from "node:test";
import { newFeedPosts, parsePublicationFeed } from "../src/lib/feed";
import { parsePublicationUrl } from "../src/lib/substack-url";

const publication = "https://writer.substack.com";
const item = (
  slug: string,
  date = "Fri, 02 Oct 2026 12:00:00 GMT",
  host = publication,
) =>
  `<item><title><![CDATA[A useful post]]></title><link>${host}/p/${slug}?utm_source=email</link><pubDate>${date}</pubDate></item>`;
const feed = (items: string) =>
  `<rss><channel><title><![CDATA[The Writer]]></title>${items}</channel></rss>`;

test("publication links accept only fixed HTTPS Substack feed hosts", () => {
  assert.equal(
    parsePublicationUrl(`${publication}/feed?utm_source=test`).feedUrl,
    `${publication}/feed`,
  );
  for (const url of [
    "https://127.0.0.1",
    "http://writer.substack.com",
    "https://writer.substack.com.evil.test",
    "https://user:pass@writer.substack.com",
    "https://writer.substack.com:3000",
    `${publication}/api/v1/posts`,
    `${publication}/p/a-post`,
  ])
    assert.throws(() => parsePublicationUrl(url));
});
test("feed discovery canonicalizes, deduplicates and ignores foreign/future links", () => {
  const parsed = parsePublicationFeed(
    feed(
      item("one") +
        item("one") +
        item("foreign", undefined, "https://foreign.substack.com") +
        item("future", "Fri, 01 Jan 2999 12:00:00 GMT"),
    ),
    publication,
  );
  assert.equal(parsed.title, "The Writer");
  assert.equal(parsed.posts.length, 1);
  assert.equal(parsed.posts[0].url, `${publication}/p/one`);
});
test("RSS external entities, document types and malformed XML are rejected", () => {
  assert.throws(() =>
    parsePublicationFeed(
      `<!DOCTYPE rss [<!ENTITY leak SYSTEM "file:///etc/passwd">]>${feed(item("one"))}`,
      publication,
    ),
  );
  assert.throws(() => parsePublicationFeed("<rss><channel>", publication));
});
test("automatic feed discovery never imports the initial backlog", () => {
  const posts = parsePublicationFeed(
    feed(
      item("older", "Thu, 01 Oct 2026 12:00:00 GMT") +
        item("newer", "Sat, 03 Oct 2026 12:00:00 GMT"),
    ),
    publication,
  ).posts;
  assert.deepEqual(
    newFeedPosts(posts, new Date("2026-10-02T00:00:00Z")).map(
      (post) => post.url,
    ),
    [`${publication}/p/newer`],
  );
});

test("second-precision RSS dates do not lose a newly discovered same-second post", () => {
  const posts = parsePublicationFeed(
    feed(item("new", "Fri, 02 Oct 2026 12:00:00 GMT")),
    publication,
  ).posts;
  assert.equal(
    newFeedPosts(posts, new Date("2026-10-02T12:00:00.500Z")).length,
    1,
  );
});
