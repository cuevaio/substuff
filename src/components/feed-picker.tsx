"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { autoQuery, type ImportIntent } from "@/lib/client-settings";
import type { FeedPost } from "@/lib/feed";

export function FeedPicker({
  posts,
  imported,
  onImport,
}: {
  posts: FeedPost[];
  imported: string[];
  onImport: (url: string, intent?: ImportIntent) => Promise<void>;
}) {
  const automatic = useQuery(autoQuery);
  const mutation = useMutation({
    mutationFn: (url: string) =>
      onImport(url, {
        version: automatic.data?.version ?? 0,
      }),
  });
  return (
    <>
      <p className="dialog-description">
        {automatic.data?.enabled
          ? "New posts import daily with approved Notes. Nothing publishes automatically. Choose an earlier post to import now."
          : "New posts import daily as drafts. Choose any earlier post to import now."}
      </p>
      {!posts.length && (
        <p className="dialog-description">No published posts were found.</p>
      )}
      <ul className="feed-post-list">
        {posts.map((post) => (
          <li key={post.url}>
            <div>
              <span>{post.title}</span>
              <small>{new Date(post.publishedAt).toLocaleDateString()}</small>
            </div>
            <button
              type="button"
              className="text-button"
              disabled={mutation.isPending || !automatic.data}
              onClick={() => mutation.mutate(post.url)}
            >
              {mutation.isPending && mutation.variables === post.url
                ? "Importing…"
                : imported.includes(post.url)
                  ? "Open"
                  : "Import"}
            </button>
          </li>
        ))}
      </ul>
      {mutation.error && (
        <p className="inline-error" role="alert">
          {mutation.error.message}
        </p>
      )}
    </>
  );
}
