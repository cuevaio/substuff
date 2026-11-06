import type { Article, Note } from "./content";
import { hasRichFormatting } from "./rich-text";
import { parseSubstackUrl } from "./substack-url";

export function noteAttachment(
  article: Pick<Article, "sourceUrl" | "title">,
  note?: Pick<Note, "includeArticle">,
) {
  if (!article.sourceUrl || note?.includeArticle === false) return {};
  return {
    metadata: {
      substack: {
        linkAttachment: {
          url: parseSubstackUrl(article.sourceUrl).url,
          title: article.title,
        },
      },
    },
  };
}
export function canSendThroughBuffer(note: Pick<Note, "richText">) {
  return !hasRichFormatting(note.richText);
}
