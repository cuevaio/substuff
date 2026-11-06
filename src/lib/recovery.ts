import type { z } from "zod";
import { workspaceSchema } from "./content";

type Document = z.infer<typeof workspaceSchema>;
export function mergeRecoveredWorkspace(target: Document, guest: Document) {
  const ids = new Set(target.articles.map((article) => article.id));
  const sources = new Set(
    target.articles.map((article) => article.sourceUrl).filter(Boolean),
  );
  const articles = [...target.articles];
  for (const article of guest.articles) {
    if (
      ids.has(article.id) ||
      (article.sourceUrl && sources.has(article.sourceUrl))
    )
      continue;
    articles.push(article);
    ids.add(article.id);
    if (article.sourceUrl) sources.add(article.sourceUrl);
  }
  const result = workspaceSchema.parse({
    ...target,
    articles,
    activeId: target.activeId || articles[0]?.id || "",
  });
  if (JSON.stringify(result).length > 2_000_000)
    throw new Error("Workspace full");
  return result;
}
