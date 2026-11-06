"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FeedPicker } from "@/components/feed-picker";
import { ImportForm } from "@/components/import-form";
import { useWorkspace } from "@/components/workspace-provider";
import {
  type AutoSettings,
  autoQuery,
  type ImportIntent,
} from "@/lib/client-settings";
import type { FeedPost } from "@/lib/feed";
import { parsePublicationUrl, parseSubstackUrl } from "@/lib/substack-url";

export function ImportPage() {
  const workspace = useWorkspace();
  const router = useRouter();
  const client = useQueryClient();
  const [feed, setFeed] = useState<{ title: string; posts: FeedPost[] } | null>(
    null,
  );
  async function importArticle(url: string, intent?: ImportIntent) {
    const settings = client.getQueryData<AutoSettings>(autoQuery.queryKey);
    const selected = intent || {
      version: settings?.version || 0,
      publishNow: settings?.enabled || false,
    };
    let publication: ReturnType<typeof parsePublicationUrl> | null = null;
    try {
      publication = parsePublicationUrl(url);
    } catch {
      /* A post link instead. */
    }
    if (!publication) {
      const source = parseSubstackUrl(url);
      const existing = workspace.document.articles.find(
        (article) => article.sourceUrl === source.url,
      );
      if (existing) {
        router.push(`/posts/${encodeURIComponent(existing.id)}`);
        return;
      }
    }
    await workspace.flush();
    const response = await fetch(
      publication ? "/api/feed" : "/api/posts/import",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          automationVersion: selected.version,
          publishNow: selected.publishNow,
        }),
        signal: AbortSignal.timeout(170000),
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Couldn’t finish this import.");
    if (publication) {
      setFeed(data);
      await client.invalidateQueries({ queryKey: ["feed"] });
    } else {
      workspace.applyServer(data.document, data.revision);
      router.push(`/posts/${encodeURIComponent(data.article.id)}`);
    }
  }
  return (
    <main id="main" className="page-content narrow-page">
      <h1>{feed?.title || "Import from Substack"}</h1>
      {feed ? (
        <FeedPicker
          posts={feed.posts}
          imported={workspace.document.articles.flatMap((article) =>
            article.sourceUrl ? [article.sourceUrl] : [],
          )}
          onImport={importArticle}
        />
      ) : (
        <>
          <p className="dialog-description">
            Add a published post or publication link.
          </p>
          <ImportForm onImport={importArticle} />
        </>
      )}
    </main>
  );
}
