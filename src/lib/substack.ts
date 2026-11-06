import { load } from "cheerio";
import { z } from "zod";
import { sanitizeArticleHtml } from "./article-html";
import { articleInput } from "./content";
import { parseSubstackUrl } from "./substack-url";

export class ImportError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}

export function extractPublishedPost(payload: unknown, sourceUrl: string) {
  const parsed = z
    .object({
      title: z.string().min(1).max(180),
      body_html: z.string().max(2_000_000),
      is_published: z.literal(true),
      audience: z.literal("everyone"),
      free_unlock_required: z.boolean().optional(),
      post_date: z.string(),
      is_editor_preview: z.boolean().optional(),
      is_geoblocked: z.boolean().optional(),
    })
    .safeParse(payload);
  if (
    !parsed.success ||
    parsed.data.free_unlock_required ||
    parsed.data.is_editor_preview ||
    parsed.data.is_geoblocked
  ) {
    throw new ImportError(
      "This post isn’t publicly available. Try a free, published post.",
    );
  }
  const post = parsed.data;
  if (
    !Number.isFinite(Date.parse(post.post_date)) ||
    Date.parse(post.post_date) > Date.now()
  ) {
    throw new ImportError("This post isn’t published yet.");
  }
  const $ = load(post.body_html);
  $(
    "script, style, noscript, iframe, .subscription-widget-wrap, .button-wrapper, .captioned-button-wrap, .paywall",
  ).remove();
  const contentHtml = sanitizeArticleHtml($("body").html() || "");
  $(
    "script, style, noscript, iframe, figure, .subscription-widget-wrap, .button-wrapper, .captioned-button-wrap, .paywall",
  ).remove();
  $("br").replaceWith("\n");
  $("p, h1, h2, h3, h4, li, blockquote, pre").append("\n\n");
  const content = $("body")
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const article = articleInput.safeParse({ title: post.title, content });
  if (!article.success)
    throw new ImportError(
      content.length > 60000
        ? "This post is too long to import right now."
        : "There isn’t enough article text in this post.",
    );
  return {
    ...article.data,
    ...(contentHtml.length <= 500000 ? { contentHtml } : {}),
    sourceUrl: parseSubstackUrl(sourceUrl).url,
  };
}

export async function importSubstackPost(value: string, request = fetch) {
  const source = parseSubstackUrl(value);
  // Only a fixed Substack host/API path is fetched. Never follow arbitrary redirects.
  const response = await request(
    `https://${source.host}/api/v1/posts/${source.slug}`,
    {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json" },
    },
  );
  if (!response.ok)
    throw new ImportError(
      response.status === 404
        ? "That post wasn’t found. Check the link."
        : "We couldn’t open that post. Try its original Substack link.",
    );
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new ImportError("That link didn’t return a Substack post.");
  if (!response.body) throw new ImportError("That post couldn’t be read.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2_000_000)
        throw new ImportError("This post is too large to import right now.");
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ImportError("That post couldn’t be read. Try again.");
  }
  return extractPublishedPost(payload, source.url);
}
