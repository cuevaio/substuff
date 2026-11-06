import assert from "node:assert/strict";
import test from "node:test";
import { workspaceSchema } from "../src/lib/content";
import { extractPublishedPost, importSubstackPost } from "../src/lib/substack";
import { parseSubstackUrl } from "../src/lib/substack-url";

const url = "https://writer.substack.com/p/a-published-post";
const paragraph =
  "A useful article starts with something specific. We can keep the original meaning while finding a few shorter thoughts worth sharing. The writer stays in control of every change, and nothing publishes without their approval.";
const payload = {
  title: "A published post",
  body_html: `<p>${paragraph}</p><p>A second paragraph.</p>`,
  is_published: true,
  audience: "everyone",
  post_date: "2026-01-01T00:00:00Z",
};

test("Substack links are canonicalized without tracking parameters", () => {
  assert.equal(parseSubstackUrl(`${url}/?utm_source=email#comments`).url, url);
});

test("saved source links must remain canonical, safe Substack post URLs", () => {
  const article = {
    id: "imported",
    title: "Post",
    content: paragraph,
    createdAt: "2026-01-01",
    mode: "ai",
    notes: [],
    sourceUrl: url,
  };
  assert.equal(
    workspaceSchema.safeParse({
      version: 1,
      activeId: "imported",
      articles: [article],
    }).success,
    true,
  );
  assert.equal(
    workspaceSchema.safeParse({
      version: 1,
      activeId: "imported",
      articles: [{ ...article, sourceUrl: "javascript:alert(1)" }],
    }).success,
    false,
  );
  assert.equal(
    workspaceSchema.safeParse({
      version: 1,
      activeId: "legacy",
      articles: [{ ...article, sourceUrl: undefined }],
    }).success,
    true,
  );
});
test("import rejects arbitrary hosts, credentials, ports and non-post URLs", () => {
  for (const value of [
    "https://127.0.0.1/p/test",
    "http://writer.substack.com/p/test",
    "https://writer.substack.com.evil.test/p/test",
    "https://writer.substack.com@evil.test/p/test",
    "https://user:pass@writer.substack.com/p/test",
    "https://writer.substack.com:3000/p/test",
    "https://writer.substack.com/feed",
    "https://substack.com/note/c-123",
    "file:///etc/passwd",
    "https://writer.substack.com/p/a%2f..%2fadmin",
  ])
    assert.throws(() => parseSubstackUrl(value));
});
test("HTML import preserves paragraphs, decodes entities and strips embeds and signup UI", () => {
  const article = extractPublishedPost(
    {
      ...payload,
      body_html: `<p>${paragraph}</p><p>One &amp; two.<br>Three.</p><script>secret()</script><iframe>Embed</iframe><div class="subscription-widget-wrap">Subscribe now</div><figure>Caption</figure>`,
    },
    url,
  );
  assert.ok(article.content.includes("One & two.\nThree."));
  assert.ok(article.content.includes("\n\n"));
  for (const removed of ["secret", "Embed", "Subscribe now", "Caption", "<p>"])
    assert.equal(article.content.includes(removed), false);
  assert.equal(article.sourceUrl, url);
});
test("paywalls, previews, unpublished posts and empty articles are not imported", () => {
  for (const changes of [
    { audience: "only_paid" },
    { is_published: false },
    { free_unlock_required: true },
    { is_editor_preview: true },
    { is_geoblocked: true },
    { post_date: "2999-01-01" },
    { body_html: "<p>Too short.</p>" },
  ])
    assert.throws(() => extractPublishedPost({ ...payload, ...changes }, url));
});
test("import uses a fixed public API path and never follows a redirect", async () => {
  let called = false;
  const request = (async (target: string, options: RequestInit) => {
    called = true;
    assert.equal(
      target,
      "https://writer.substack.com/api/v1/posts/a-published-post",
    );
    assert.equal(options.redirect, "manual");
    assert.equal(options.cache, "no-store");
    return new Response(null, {
      status: 302,
      headers: { Location: "http://127.0.0.1/private" },
    });
  }) as unknown as typeof fetch;
  await assert.rejects(importSubstackPost(url, request));
  assert.equal(called, true);
});
test("import accepts bounded public JSON and rejects oversized response streams", async () => {
  const request = (async () =>
    Response.json(payload)) as unknown as typeof fetch;
  assert.equal((await importSubstackPost(url, request)).title, payload.title);
  const oversized = (async () =>
    new Response("x".repeat(2_000_001), {
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
  await assert.rejects(importSubstackPost(url, oversized), /too large/);
});
