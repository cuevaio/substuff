"use client";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  Copy,
  FileText,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BufferPanel } from "@/components/buffer-panel";
import { Dialog } from "@/components/dialog";
import { NoteEditor } from "@/components/note-editor";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-provider";
import { type Article, exportNotes, type Note } from "@/lib/content";
import {
  hasRichFormatting,
  plainDocument,
  richTextHtml,
} from "@/lib/rich-text";

function SourcePane({ article }: { article: Article }) {
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
  return (
    <aside className="article-pane" aria-label="Original Substack post">
      <header>
        <span>Original post</span>
        {article.sourceUrl && (
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="icon-button"
            aria-label="Read on Substack"
          >
            <ArrowUpRight size={15} />
          </a>
        )}
      </header>
      <div className="article-scroll">
        <h2>{article.title}</h2>
        {query.isPending && (
          <p className="input-caption" role="status">
            Loading formatted post…
          </p>
        )}
        {query.error && (
          <p className="input-caption" role="status">
            {query.error.message}
          </p>
        )}
        {query.data?.warning && (
          <p className="input-caption" role="status">
            {query.data.warning}
          </p>
        )}
        {query.data?.html ? (
          <div
            className="article-prose"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Authenticated endpoint always sanitizes with a restrictive HTML allowlist.
            dangerouslySetInnerHTML={{ __html: query.data.html }}
          />
        ) : (
          <div className="article-prose">
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
  const article = workspace.document.articles.find(
    (article) => article.id === articleId,
  );
  const [sourceVisible, setSourceVisible] = useState(true);
  const [approvedOnly, setApprovedOnly] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [restore, setRestore] = useState<Note | null>(null);
  const [plainNote, setPlainNote] = useState<Note | null>(null);
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
  const approved = article.notes.filter((note) => note.approved);
  function update(note: Note, changes: Partial<Note>) {
    workspace.updateNote(articleId, note.id, changes);
  }
  async function copy(note: Note) {
    try {
      if (
        note.richText &&
        hasRichFormatting(note.richText) &&
        typeof ClipboardItem !== "undefined"
      )
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([richTextHtml(note.richText)], {
              type: "text/html",
            }),
            "text/plain": new Blob([note.text], { type: "text/plain" }),
          }),
        ]);
      else if (hasRichFormatting(note.richText)) {
        setNotice(
          "Formatted clipboard isn’t available in this browser. Select the Note and copy it directly to preserve formatting.",
        );
        return;
      } else await navigator.clipboard.writeText(note.text);
      setNotice("Copied");
    } catch {
      setNotice(
        "Select the Note and copy it directly; clipboard access is unavailable.",
      );
    }
  }
  function download() {
    if (!article) return;
    const url = URL.createObjectURL(
      new Blob([exportNotes(article)], { type: "text/plain" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "approved-notes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main
      id="main"
      className={`post-page ${sourceVisible ? "with-source" : ""}`}
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
          <button
            type="button"
            className="text-button"
            aria-pressed={approvedOnly}
            onClick={() => setApprovedOnly(!approvedOnly)}
          >
            {approvedOnly ? "Approved only" : "All Notes"}
          </button>
          <span>{approved.length} approved</span>
        </div>
        <div className="compact-notes">
          {article.notes
            .filter((note) => !approvedOnly || note.approved)
            .map((note) => (
              <article className="compact-note" key={note.id}>
                <NoteEditor
                  note={note}
                  onChange={(changes) =>
                    update(note, { ...changes, approved: false })
                  }
                />
                {article.sourceUrl && (
                  <a
                    className="note-article-card"
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText size={16} />
                    <span>
                      {article.title}
                      <small>{new URL(article.sourceUrl).hostname}</small>
                    </span>
                    <ArrowUpRight size={14} />
                  </a>
                )}
                {hasRichFormatting(note.richText) && (
                  <p className="format-warning">
                    Formatting is saved here. Copy to Substack to keep it;
                    Buffer only publishes plain text.{" "}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setPlainNote(note)}
                    >
                      Use plain text
                    </button>
                  </p>
                )}
                <div className="compact-note-tools">
                  <button
                    type="button"
                    className="text-button"
                    aria-expanded={sourceId === note.id}
                    onClick={() =>
                      setSourceId(sourceId === note.id ? null : note.id)
                    }
                  >
                    Source
                  </button>
                  <div>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Copy Note"
                      title="Copy Note"
                      onClick={() => void copy(note)}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Restore original Note"
                      title="Restore original Note"
                      disabled={
                        note.text === note.original &&
                        !hasRichFormatting(note.richText)
                      }
                      onClick={() => setRestore(note)}
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      type="button"
                      className={`approve-button ${note.approved ? "approved" : ""}`}
                      disabled={!note.text.trim() || note.text.length > 10000}
                      aria-pressed={note.approved}
                      onClick={() => update(note, { approved: !note.approved })}
                    >
                      <Check size={13} />
                      {note.approved ? "Approved" : "Approve"}
                    </button>
                  </div>
                </div>
                {sourceId === note.id && (
                  <blockquote className="source-passage">
                    {note.source}
                  </blockquote>
                )}
              </article>
            ))}
          {approvedOnly && !approved.length && (
            <p className="empty-filter">No approved Notes yet.</p>
          )}
        </div>
        <footer className="post-review">
          <span>
            {approved.length
              ? `${approved.length} ready to review`
              : "Approve Notes to share"}
          </span>
          <Button disabled={!approved.length} onClick={() => setReview(true)}>
            Review Notes
          </Button>
        </footer>
      </section>
      {sourceVisible && <SourcePane article={article} />}
      {review && (
        <Dialog title="Share Notes" onClose={() => setReview(false)}>
          <BufferPanel
            article={article}
            beforeSend={workspace.flush}
            onExport={download}
          />
        </Dialog>
      )}
      {restore && (
        <Dialog title="Restore this Note?" onClose={() => setRestore(null)}>
          <p className="dialog-description">
            Replace your edits and formatting with the original draft?
          </p>
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => setRestore(null)}>
              Keep edits
            </Button>
            <Button
              onClick={() => {
                update(restore, {
                  text: restore.original,
                  richText: plainDocument(restore.original),
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
      {plainNote && (
        <Dialog title="Use plain text?" onClose={() => setPlainNote(null)}>
          <p className="dialog-description">
            Remove this Note’s formatting so Buffer can publish it? Its text
            stays unchanged. You’ll need to approve it again.
          </p>
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => setPlainNote(null)}>
              Keep formatting
            </Button>
            <Button
              onClick={() => {
                update(plainNote, {
                  richText: plainDocument(plainNote.text),
                  approved: false,
                });
                setPlainNote(null);
              }}
            >
              Remove formatting
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
