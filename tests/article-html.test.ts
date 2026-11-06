import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeArticleHtml } from "../src/lib/article-html";

test("formatted original posts preserve headings, lists, quotes, images and emphasis", () => {
  const html = sanitizeArticleHtml(
    '<h2>A heading</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>One</li></ul><blockquote>A quote</blockquote><figure><img src="https://substackcdn.com/image.png" alt="Image"><figcaption>Caption</figcaption></figure>',
  );
  for (const tag of [
    "h2",
    "strong",
    "em",
    "ul",
    "li",
    "blockquote",
    "figure",
    "img",
    "figcaption",
  ])
    assert.ok(html.includes(`<${tag}`));
});
test("untrusted source HTML cannot execute scripts, event handlers, embeds or unsafe URLs", () => {
  const html = sanitizeArticleHtml(
    '<script>SECRET</script><style>evil</style><iframe src="https://evil.test"></iframe><p onclick="evil()">Safe</p><a href="javascript:evil()">link</a><img src="data:image/svg+xml,evil" onerror="evil()"><a href="https://example.com">Good</a>',
  );
  for (const bad of [
    "<script",
    "SECRET",
    "<iframe",
    "onclick",
    "onerror",
    "javascript:",
    "data:",
    "<style",
  ])
    assert.equal(html.includes(bad), false);
  assert.ok(html.includes("noopener noreferrer"));
  assert.ok(html.includes("https://example.com"));
});
