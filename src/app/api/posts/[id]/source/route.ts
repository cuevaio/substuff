import { NextResponse } from "next/server";
import { readAccountSession } from "@/lib/account-session";
import { sanitizeArticleHtml } from "@/lib/article-html";
import { normalize } from "@/lib/content";
import { importSubstackPost } from "@/lib/substack";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/posts/[id]/source">,
) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const workspace = await readAccountSession();
    if (!workspace)
      return NextResponse.json(
        { error: "Sign in to read your post." },
        { status: 401, headers },
      );
    const { id } = await context.params;
    const article = workspace.document.articles.find(
      (article) => article.id === id && article.mode !== "sample",
    );
    if (!article)
      return NextResponse.json(
        { error: "Post not found." },
        { status: 404, headers },
      );
    let html = article.contentHtml || null;
    if (!html && article.sourceUrl) {
      const published = await importSubstackPost(article.sourceUrl);
      if (normalize(published.content) !== normalize(article.content))
        return NextResponse.json(
          {
            html: null,
            warning:
              "The published post has changed. Showing the saved source text so your Notes keep their original context.",
          },
          { headers },
        );
      html = published.contentHtml || null;
    }
    return NextResponse.json(
      { html: html ? sanitizeArticleHtml(html) : null },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Couldn’t load the formatted post. The saved text is shown instead.",
      },
      { status: 502, headers },
    );
  }
}
