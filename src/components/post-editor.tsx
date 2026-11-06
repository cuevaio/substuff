"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BufferPanel, connectionQuery } from "@/components/buffer-panel";
import { Dialog } from "@/components/dialog";
import {
  ArrowUpRight,
  PanelRightClose,
  PanelRightOpen,
} from "@/components/icons";
import { NoteCard } from "@/components/note-card";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useWorkspace } from "@/components/workspace-provider";
import { deliveryQuery } from "@/lib/client-deliveries";
import { type Article, exportNotes, type Note } from "@/lib/content";
import { noteProfile } from "@/lib/note-profile";
import { lockedDelivery, noteState } from "@/lib/note-state";
import { highlightSource, scrollToSource } from "@/lib/source-match";

type Source = { noteId: string; text: string; nonce: number };
function SourcePane({
  article,
  source,
}: {
  article: Article;
  source: Source | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [savedSource, setSavedSource] = useState(false);
  const query = useQuery({
    queryKey: ["formatted-source", article.id],
    queryFn: async () => {
      const response = await fetch(
        `/api/posts/${encodeURIComponent(article.id)}/source`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Couldn’t open the formatted post.");
      return data as { html: string | null; warning?: string };
    },
    staleTime: 300000,
    retry: false,
  });
  useEffect(() => {
    if (!root.current || !source) return;
    const found = highlightSource(root.current, source.text);
    if (!found && query.data?.html && !savedSource) {
      setSavedSource(true);
      return;
    }
    if (found && scroll.current) scrollToSource(scroll.current);
  }, [source, query.data, savedSource]);
  return (
    <aside
      id="original-post"
      className="article-pane"
      aria-label="Original Substack post"
    >
      <header>
        <span>Original post</span>
        {article.sourceUrl && (
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="icon-button"
            aria-label="Read on Substack"
          >
            <ArrowUpRight size={16} />
          </a>
        )}
      </header>
      <div className="article-scroll" ref={scroll}>
        <h2>{article.title}</h2>
        {query.isPending && (
          <p className="input-caption" role="status">
            Loading formatted post…
          </p>
        )}
        {(query.error || query.data?.warning || savedSource) && (
          <p className="input-caption" role="status">
            {query.error?.message ||
              query.data?.warning ||
              "Showing the saved original to highlight the exact source passage."}
          </p>
        )}
        {query.data?.html && !savedSource ? (
          <div
            ref={root}
            className="article-prose"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: The authenticated source endpoint always sanitizes HTML with a restrictive allowlist.
            dangerouslySetInnerHTML={{ __html: query.data.html }}
          />
        ) : (
          <div ref={root} className="article-prose">
            {article.content.split(/\n\s*\n/).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

export function PostEditor({ articleId }: { articleId: string }) {
  const workspace = useWorkspace();
  const client = useQueryClient();
  const article = workspace.document.articles.find(
    (article) => article.id === articleId,
  );
  const history = useQuery(deliveryQuery(articleId));
  const connection = useQuery(connectionQuery);
  const receipts = history.data?.deliveries || [];
  const [sourceVisible, setSourceVisible] = useState(true);
  const [filter, setFilter] = useState("all");
  const [source, setSource] = useState<Source | null>(null);
  const [review, setReview] = useState(false);
  const [restore, setRestore] = useState<Note | null>(null);
  const [editing, setEditing] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    workspace.setActive(articleId);
  }, [articleId, workspace.setActive]);
  useEffect(() => {
    setSourceVisible(localStorage.getItem("substuff.source-hidden") !== "true");
  }, []);
  if (!article)
    return (
      <main id="main" className="page-content">
        <h1>Post not found</h1>
        <Link href="/import">Import a post</Link>
      </main>
    );
  const approved = article.notes.filter(
    (note) => noteState(note, receipts) === "approved",
  );
  const reviewArticle = {
    ...article,
    notes: article.notes.filter(
      (note) => noteState(note, receipts) !== "posted",
    ),
  };
  function update(note: Note, changes: Partial<Note>) {
    workspace.updateNote(articleId, note.id, changes);
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied");
    } catch {
      setNotice(
        "Clipboard unavailable. Select the Note text and copy it directly.",
      );
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([exportNotes(reviewArticle)], { type: "text/plain" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "approved-notes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }
  function requestEdit(note: Note) {
    const own = receipts.filter((receipt) => receipt.noteId === note.id);
    if (
      own.some(
        (receipt) =>
          ["sent", "sending", "unknown", "creating"].includes(receipt.status) ||
          (lockedDelivery(receipt.status) && !receipt.bufferPostId),
      )
    ) {
      setNotice(
        "This Note is posted or may be publishing. Check its status in Buffer before making changes.",
      );
      return;
    }
    if (
      own.some(
        (receipt) =>
          receipt.bufferPostId &&
          ["scheduled", "draft", "needs_approval", "error"].includes(
            receipt.status,
          ),
      )
    ) {
      setEditing(note);
      return;
    }
    update(note, { approved: false, richText: undefined });
  }
  async function cancelAndEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      await workspace.flush();
      for (const receipt of receipts.filter(
        (receipt) =>
          receipt.noteId === editing.id &&
          receipt.bufferPostId &&
          ["scheduled", "draft", "needs_approval", "error"].includes(
            receipt.status,
          ),
      )) {
        const response = await fetch(
          `/api/buffer/deliveries/${encodeURIComponent(receipt.id)}`,
          { method: "DELETE" },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error ||
              "Couldn’t confirm cancellation. Check Buffer before editing.",
          );
      }
      const fresh = await history.refetch();
      if (
        fresh.error ||
        fresh.data?.deliveries.some(
          (receipt) =>
            receipt.noteId === editing.id &&
            (lockedDelivery(receipt.status) ||
              (receipt.status === "error" && Boolean(receipt.bufferPostId))),
        )
      )
        throw new Error(
          "This Note may already be posted. Its text remains read-only.",
        );
      update(editing, { approved: false, richText: undefined });
      setEditing(null);
      await client.invalidateQueries({ queryKey: ["schedule"] });
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : "Couldn’t unlock this Note.",
      );
      await history.refetch();
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      id="main"
      className={`post-page note-workflow ${sourceVisible ? "with-source" : ""}`}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && sourceVisible) {
          const pane =
            event.currentTarget.querySelector<HTMLElement>(".article-scroll");
          if (pane && source) scrollToSource(pane);
        }
      }}
    >
      <section className="notes-pane" aria-label="Notes">
        <header className="post-heading">
          <div>
            <h1>{article.title}</h1>
            <span className="input-caption">{article.notes.length} Notes</span>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={
              sourceVisible ? "Hide original post" : "Show original post"
            }
            aria-expanded={sourceVisible}
            aria-controls="original-post"
            onClick={() => {
              setSourceVisible(!sourceVisible);
              localStorage.setItem(
                "substuff.source-hidden",
                String(sourceVisible),
              );
            }}
          >
            {sourceVisible ? (
              <PanelRightClose size={18} />
            ) : (
              <PanelRightOpen size={18} />
            )}
          </button>
        </header>
        <div className="notes-controls">
          <fieldset className="note-filters" aria-label="Filter Notes">
            {[
              ["all", "All"],
              ["to-approve", "To approve"],
              ["approved", "Approved"],
              ["posted", "Posted"],
            ].map(([value, label]) => (
              <button
                type="button"
                className="text-button"
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </fieldset>
        </div>
        {history.error && (
          <p className="inline-error" role="alert">
            {history.error.message}{" "}
            <button type="button" onClick={() => void history.refetch()}>
              Try again
            </button>
          </p>
        )}
        <TooltipProvider delayDuration={400} skipDelayDuration={300}>
          <div className="compact-notes">
            {article.notes
              .filter(
                (note) =>
                  filter === "all" || noteState(note, receipts) === filter,
              )
              .map((note) => {
                const own = receipts.filter(
                  (receipt) => receipt.noteId === note.id,
                );
                return (
                  <NoteCard
                    key={note.id}
                    article={article}
                    note={note}
                    receipts={own}
                    ready={Boolean(history.data)}
                    profile={noteProfile(
                      connection.data?.channels || [],
                      own.find((receipt) => receipt.status === "sent")
                        ?.channelId ||
                        own.find((receipt) => receipt.bufferPostId)?.channelId,
                    )}
                    onUpdate={(changes) => update(note, changes)}
                    onCopy={(text) => void copy(text)}
                    onEdit={() => requestEdit(note)}
                    onRestore={() => setRestore(note)}
                    onSource={() => {
                      setSourceVisible(true);
                      localStorage.setItem("substuff.source-hidden", "false");
                      setSource({
                        noteId: note.id,
                        text: note.source,
                        nonce: Date.now(),
                      });
                    }}
                  />
                );
              })}
            {!article.notes.some(
              (note) =>
                filter === "all" || noteState(note, receipts) === filter,
            ) && <p className="empty-filter">No Notes in this state.</p>}
          </div>
        </TooltipProvider>
        <footer className="post-review">
          <span>
            {approved.length
              ? `${approved.length} ready to share`
              : "Approve Notes to share"}
          </span>
          <Button
            disabled={!approved.length || !history.data}
            onClick={() => setReview(true)}
          >
            Review Notes
          </Button>
        </footer>
      </section>
      <div
        className="source-drawer"
        data-open={sourceVisible}
        inert={!sourceVisible}
        aria-hidden={!sourceVisible}
      >
        <div className="source-drawer-inner">
          <SourcePane article={article} source={source} />
        </div>
      </div>
      {review && (
        <Dialog title="Share Notes" onClose={() => setReview(false)}>
          <BufferPanel
            article={reviewArticle}
            beforeSend={workspace.flush}
            onExport={download}
          />
        </Dialog>
      )}
      {restore && (
        <Dialog title="Restore this Note?" onClose={() => setRestore(null)}>
          <p className="dialog-description">
            Replace your edits with the original draft?
          </p>
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => setRestore(null)}>
              Keep edits
            </Button>
            <Button
              onClick={() => {
                update(restore, {
                  text: restore.original,
                  richText: undefined,
                  approved: false,
                });
                setRestore(null);
              }}
            >
              Restore draft
            </Button>
          </div>
        </Dialog>
      )}
      {editing && (
        <Dialog
          title="Edit this Note?"
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <p className="dialog-description">
            Its existing Buffer copy must be cancelled first, so the older text
            won’t publish while you edit. An in-flight publication may finish;
            posted Notes can’t be edited.
          </p>
          <div className="dialog-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Keep queued
            </Button>
            <Button disabled={busy} onClick={() => void cancelAndEdit()}>
              Cancel copy & edit
            </Button>
          </div>
        </Dialog>
      )}
      {notice && (
        <div className="compact-notice" role="status">
          {notice}
          <button
            type="button"
            className="text-button"
            onClick={() => setNotice("")}
          >
            Dismiss
          </button>
        </div>
      )}
    </main>
  );
}
