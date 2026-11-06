"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Brand, Mark } from "@/components/brand";
import { BufferPanel, BufferPreferences } from "@/components/buffer-panel";
import { Dialog } from "@/components/dialog";
import { ImportForm } from "@/components/import-form";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  type Article,
  exportNotes,
  generatedNotes,
  type Note,
  sampleArticle,
  workspaceSchema,
} from "@/lib/content";
import { parseSubstackUrl } from "@/lib/substack-url";

const STORAGE = "substuff.workspace.v1";
type Modal = "article" | "review" | "settings" | null;
type SaveState = "saved" | "saving" | "unavailable";

function AutoTextarea({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const field = ref.current;
    if (!field || field.value !== value) return;
    const resize = () => {
      field.style.height = "0px";
      field.style.height = `${field.scrollHeight + 2}px`;
    };
    resize();
    let width = field.clientWidth;
    const observer = new ResizeObserver(() => {
      if (width === field.clientWidth) return;
      width = field.clientWidth;
      resize();
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="note-editor"
      value={value}
      aria-label={label}
      maxLength={10000}
      spellCheck
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export default function Home() {
  const queryClient = useQueryClient();
  const [loaded, setLoaded] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeId, setActiveId] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [modal, setModal] = useState<Modal>(null);
  const [tab, setTab] = useState<"notes" | "source">("notes");
  const [filter, setFilter] = useState<"all" | "approved">("all");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const importAbort = useRef<AbortController | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [restoreNote, setRestoreNote] = useState<Note | null>(null);
  const [cloud, setCloud] = useState(false);
  const [saveError, setSaveError] = useState("");
  const revision = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const cloudPaused = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const article = articles.find((a) => a.id === activeId) ?? articles[0];
  const approved = article?.notes.filter((n) => n.approved) ?? [];
  const visibleNotes =
    article?.notes.filter((n) => filter !== "approved" || n.approved) ?? [];

  useEffect(() => {
    setSidebarOpen(
      !document.cookie.split("; ").includes("sidebar_state=false"),
    );
    async function restore() {
      let local: ReturnType<typeof workspaceSchema.parse> | null = null;
      try {
        const raw = localStorage.getItem(STORAGE);
        if (raw) local = workspaceSchema.parse(JSON.parse(raw));
      } catch {
        setSaveState("unavailable");
      }
      try {
        const response = await fetch("/api/workspace", {
          signal: AbortSignal.timeout(10000),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (data.storage === "cloud") {
          setCloud(true);
          revision.current = data.revision;
          const remote = data.document
            ? workspaceSchema.parse(data.document)
            : null;
          // The server is authoritative for an established session. New sessions may import local work.
          const restored = remote ?? local;
          if (restored) {
            setArticles(restored.articles);
            setActiveId(restored.activeId);
          }
          const bufferResult = new URLSearchParams(window.location.search).get(
            "buffer",
          );
          if (bufferResult) {
            const messages: Record<string, string> = {
              connected: "Buffer connected. Your Notes are ready to review.",
              cancelled: "Connection cancelled. Your drafts are safe.",
              expired: "That connection attempt expired. Please try again.",
              account:
                "This workspace belongs to a different Buffer account. Use a separate browser profile to connect another account.",
              conflict:
                "Your workspace changed in another tab. Please reconnect.",
              full: "This account’s workspace is full. Export some articles before connecting.",
              error:
                "Buffer connection failed. Your drafts are safe; please try again.",
            };
            setToast(messages[bufferResult] || messages.error);
            if (bufferResult === "connected" && restored?.articles.length)
              setModal("review");
            window.history.replaceState({}, "", "/");
          }
        } else if (local) {
          setArticles(local.articles);
          setActiveId(local.activeId);
        }
      } catch {
        if (local) {
          setArticles(local.articles);
          setActiveId(local.activeId);
        }
        cloudPaused.current = true;
        setSaveError(
          "Couldn’t open your saved workspace. Your edits are available on this device.",
        );
      }
      setLoaded(true);
    }
    void restore();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    const timeout = setTimeout(() => {
      const document = { version: 1 as const, articles, activeId };
      try {
        localStorage.setItem(STORAGE, JSON.stringify(document));
        setSaveState("saved");
      } catch {
        setSaveState("unavailable");
      }
      if (
        cloud &&
        !cloudPaused.current &&
        (articles.length || revision.current > 0)
      ) {
        setSaveState("saving");
        saveQueue.current = saveQueue.current.then(async () => {
          if (cloudPaused.current) return;
          try {
            const response = await fetch("/api/workspace", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ document, revision: revision.current }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            revision.current = data.revision;
            setSaveState("saved");
          } catch (cause) {
            cloudPaused.current = true;
            setSaveState("unavailable");
            setSaveError(
              cause instanceof Error
                ? cause.message
                : "Saving is paused. Export a copy of your edits.",
            );
          }
        });
      }
    }, 350);
    saveTimer.current = timeout;
    return () => clearTimeout(timeout);
  }, [articles, activeId, loaded, cloud]);

  async function flushWorkspace() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!cloud || cloudPaused.current)
      throw new Error(
        "Saving is paused. Export your edits and reload before sharing.",
      );
    const document = { version: 1 as const, articles, activeId };
    try {
      localStorage.setItem(STORAGE, JSON.stringify(document));
    } catch {
      /* Cloud save can still succeed. */
    }
    const operation = saveQueue.current.then(async () => {
      if (cloudPaused.current)
        throw new Error("Saving is paused. Export a copy before reloading.");
      setSaveState("saving");
      const response = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document, revision: revision.current }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Your edits couldn’t be saved.");
      revision.current = data.revision;
      setSaveState("saved");
    });
    saveQueue.current = operation.catch(() => {});
    try {
      await operation;
    } catch (cause) {
      cloudPaused.current = true;
      setSaveState("unavailable");
      setSaveError(
        cause instanceof Error ? cause.message : "Saving is paused.",
      );
      throw cause;
    }
  }

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  function selectArticle(id: string) {
    setActiveId(id);
    setTab("notes");
    setFilter("all");
    setSourceId(null);
  }

  function addArticle(next: Article) {
    setArticles((previous) => [
      next,
      ...previous.filter((a) => a.id !== next.id),
    ]);
    selectArticle(next.id);
    setModal(null);
  }

  function openArticle() {
    setModal("article");
  }

  function loadSample() {
    const existing = articles.find((a) => a.id === sampleArticle.id);
    if (existing) selectArticle(existing.id);
    else addArticle(structuredClone(sampleArticle));
  }

  function updateNote(id: string, changes: Partial<Note>) {
    if (!article) return;
    setArticles((previous) =>
      previous.map((a) =>
        a.id !== article.id
          ? a
          : {
              ...a,
              notes: a.notes.map((n) =>
                n.id !== id ? n : { ...n, ...changes },
              ),
            },
      ),
    );
  }

  async function importArticle(url: string) {
    const source = parseSubstackUrl(url);
    const existing = articles.find((a) => a.sourceUrl === source.url);
    if (existing) {
      selectArticle(existing.id);
      setModal(null);
      setToast("Already imported");
      return;
    }
    const controller = new AbortController();
    importAbort.current = controller;
    try {
      const input = await queryClient.fetchQuery({
        queryKey: ["imported-post", source.url],
        staleTime: 300000,
        queryFn: async () => {
          const imported = await fetch("/api/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: source.url }),
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(20000),
            ]),
          });
          const data = await imported.json();
          if (!imported.ok)
            throw new Error(data.error || "Couldn’t import that post.");
          return data as { title: string; content: string; sourceUrl: string };
        },
      });
      controller.signal.throwIfAborted();
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: input.title, content: input.content }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(60000),
        ]),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "We couldn’t create Notes. Please try again.",
        );
      const notes: Note[] = generatedNotes
        .parse(data)
        .notes.map((n, index) => ({
          ...n,
          id: `note-${index}`,
          original: n.text,
          approved: false,
        }));
      controller.signal.throwIfAborted();
      addArticle({
        id: crypto.randomUUID(),
        title: input.title,
        content: input.content,
        sourceUrl: input.sourceUrl,
        notes,
        createdAt: new Date().toISOString(),
        mode: "ai",
      });
    } finally {
      if (importAbort.current === controller) importAbort.current = null;
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied to clipboard");
    } catch {
      setToast("Clipboard unavailable. Select the text and copy it instead.");
    }
  }

  function download() {
    if (!article || !approved.length) return;
    const url = URL.createObjectURL(
      new Blob([exportNotes(article)], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${
      article.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 60) || "substuff"
    }-notes.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("Approved Notes exported");
  }

  if (!loaded)
    return (
      <div className="boot" role="status" aria-label="Loading substuff">
        <Mark />
      </div>
    );

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {!article ? (
        <div className="welcome-shell">
          <header className="welcome-header">
            <Brand />
            <a href="/privacy" className="text-button">
              Privacy
            </a>
          </header>
          <main id="main" className="welcome">
            <div className="welcome-copy">
              <h1>More from every post.</h1>
              <p>Turn your published Substack posts into Notes.</p>
              <ImportForm onImport={importArticle} />
              <button
                type="button"
                className="text-button sample-link"
                onClick={loadSample}
              >
                Try an example <ArrowRight size={14} />
              </button>
            </div>
          </main>
        </div>
      ) : (
        <SidebarProvider
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          className="app-shell"
          style={
            {
              "--review-offset": sidebarOpen ? "16rem" : "0px",
            } as React.CSSProperties
          }
        >
          <AppSidebar
            articles={articles}
            activeId={article.id}
            onSelect={selectArticle}
            onImport={openArticle}
            onSettings={() => setModal("settings")}
          />
          <div className="workspace">
            <header className="workspace-header">
              <div className="breadcrumb">
                <SidebarTrigger className="workspace-sidebar-trigger" />
                <span>Notes</span>
              </div>
              <span className="save-state" role="status">
                {saveState === "saving" ? (
                  "Saving…"
                ) : saveState === "unavailable" ? (
                  "Save paused · export a copy"
                ) : (
                  <>
                    <Check size={13} /> Saved
                  </>
                )}
              </span>
            </header>
            <main id="main" className="editor-main">
              {saveError && (
                <p role="alert" className="inline-error">
                  {saveError}
                </p>
              )}
              <div className="article-heading">
                {article.mode === "sample" && (
                  <span className="sample-badge">Example</span>
                )}
                <h1>{article.title}</h1>
                {article.sourceUrl && (
                  <a
                    className="article-origin"
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read on Substack <ChevronRight size={12} />
                  </a>
                )}
              </div>
              <div className="editor-tabs">
                <div role="tablist" aria-label="Article view">
                  <button
                    id="notes-tab"
                    type="button"
                    role="tab"
                    aria-controls="notes-panel"
                    aria-selected={tab === "notes"}
                    tabIndex={tab === "notes" ? 0 : -1}
                    className={tab === "notes" ? "tab selected" : "tab"}
                    onClick={() => setTab("notes")}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                        setTab("source");
                        document.getElementById("source-tab")?.focus();
                      }
                    }}
                  >
                    Notes <span>{article.notes.length}</span>
                  </button>
                  <button
                    id="source-tab"
                    type="button"
                    role="tab"
                    aria-controls="source-panel"
                    aria-selected={tab === "source"}
                    tabIndex={tab === "source" ? 0 : -1}
                    className={tab === "source" ? "tab selected" : "tab"}
                    onClick={() => setTab("source")}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                        setTab("notes");
                        document.getElementById("notes-tab")?.focus();
                      }
                    }}
                  >
                    Original post
                  </button>
                </div>
                {tab === "notes" && (
                  <button
                    className="filter-button"
                    type="button"
                    aria-pressed={filter === "approved"}
                    onClick={() =>
                      setFilter(filter === "all" ? "approved" : "all")
                    }
                  >
                    {filter === "all" ? "All Notes" : "Approved"}
                    <ChevronDown size={13} />
                  </button>
                )}
              </div>
              {tab === "notes" ? (
                <section
                  id="notes-panel"
                  role="tabpanel"
                  aria-labelledby="notes-tab"
                  className="notes-list"
                >
                  {visibleNotes.length === 0 && (
                    <div className="empty-filter">
                      <Check size={25} />
                      <p>No approved Notes yet.</p>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => setFilter("all")}
                      >
                        Back to all Notes <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                  {visibleNotes.map((note) => (
                    <article className="note-row" key={note.id}>
                      <div className="note-index">
                        {String(
                          article.notes.findIndex((n) => n.id === note.id) + 1,
                        ).padStart(2, "0")}
                      </div>
                      <div className="note-content">
                        <div className="note-top">
                          <button
                            type="button"
                            className={`approve-button ${note.approved ? "approved" : ""}`}
                            aria-pressed={note.approved}
                            disabled={
                              !note.text.trim() || note.text.length > 10000
                            }
                            onClick={() =>
                              updateNote(note.id, { approved: !note.approved })
                            }
                          >
                            <Check size={14} />
                            {note.approved ? "Approved" : "Approve"}
                          </button>
                        </div>
                        <AutoTextarea
                          value={note.text}
                          label={`Edit Note ${article.notes.findIndex((n) => n.id === note.id) + 1}`}
                          onChange={(text) =>
                            updateNote(note.id, { text, approved: false })
                          }
                        />
                        <div className="note-tools">
                          <button
                            className="source-button"
                            type="button"
                            aria-expanded={sourceId === note.id}
                            onClick={() =>
                              setSourceId(sourceId === note.id ? null : note.id)
                            }
                          >
                            <FileText size={13} />
                            Source
                            <ChevronDown
                              size={12}
                              className={sourceId === note.id ? "rotated" : ""}
                            />
                          </button>
                          <div>
                            <button
                              className="icon-button"
                              type="button"
                              aria-label={`Copy Note ${article.notes.findIndex((n) => n.id === note.id) + 1}`}
                              onClick={() => copy(note.text)}
                            >
                              <Copy size={14} />
                            </button>
                            <button
                              className="icon-button"
                              type="button"
                              disabled={note.text === note.original}
                              aria-label={`Restore Note ${article.notes.findIndex((n) => n.id === note.id) + 1}`}
                              onClick={() => setRestoreNote(note)}
                            >
                              <RotateCcw size={14} />
                            </button>
                          </div>
                        </div>
                        {sourceId === note.id && (
                          <blockquote className="source-passage">
                            {note.source}
                          </blockquote>
                        )}
                      </div>
                    </article>
                  ))}
                </section>
              ) : (
                <section
                  id="source-panel"
                  role="tabpanel"
                  aria-labelledby="source-tab"
                  className="original-article"
                >
                  {article.content.split(/\n\s*\n/).map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </section>
              )}
              <div className="editor-end">
                {article.mode === "sample" && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={openArticle}
                  >
                    Import your post <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </main>
            <footer className="review-bar">
              <div>
                <span className="review-count">
                  {approved.length
                    ? `${approved.length} of ${article.notes.length} approved`
                    : "Choose Notes to share"}
                </span>
              </div>
              <button
                className="button primary"
                type="button"
                disabled={!approved.length}
                onClick={() => setModal("review")}
              >
                Review{" "}
                {approved.length
                  ? `${approved.length} ${approved.length === 1 ? "Note" : "Notes"}`
                  : "Notes"}
                <ArrowRight size={16} />
              </button>
            </footer>
          </div>
        </SidebarProvider>
      )}

      {modal === "article" && (
        <Dialog
          title="Import a post"
          onClose={() => {
            importAbort.current?.abort();
            setModal(null);
          }}
        >
          <p className="dialog-description">
            Add a published Substack post link.
          </p>
          <ImportForm onImport={importArticle} />
        </Dialog>
      )}

      {modal === "review" && article && (
        <Dialog title="Share Notes" onClose={() => setModal(null)}>
          <BufferPanel
            article={article}
            beforeSend={flushWorkspace}
            onExport={download}
          />
        </Dialog>
      )}

      {modal === "settings" && (
        <Dialog
          title="Settings"
          onClose={() => {
            setModal(null);
            setConfirmClear(false);
          }}
        >
          <BufferPreferences beforeConnect={flushWorkspace} />
          <a href="/privacy" className="text-button">
            Privacy
          </a>
          <div className="dialog-actions">
            <button
              className="text-button"
              type="button"
              onClick={() => setConfirmClear(!confirmClear)}
            >
              Clear workspace
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setModal(null)}
            >
              Done
            </button>
          </div>
          {confirmClear && (
            <div className="clear-confirm">
              <p>
                Delete all imported posts and edits? Scheduled Notes stay in
                Buffer.
              </p>
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setArticles([]);
                  setActiveId("");
                  setModal(null);
                  setConfirmClear(false);
                  setToast("Workspace cleared");
                }}
              >
                Delete posts and edits
              </button>
            </div>
          )}
        </Dialog>
      )}

      {restoreNote && (
        <Dialog title="Restore this Note?" onClose={() => setRestoreNote(null)}>
          <p className="dialog-description">
            Your edits to this Note will be replaced with the original draft.
            Other Notes won’t change.
          </p>
          <div className="dialog-actions">
            <button
              className="text-button"
              type="button"
              onClick={() => setRestoreNote(null)}
            >
              Keep my edits
            </button>
            <button
              className="button primary"
              type="button"
              onClick={() => {
                updateNote(restoreNote.id, {
                  text: restoreNote.original,
                  approved: false,
                });
                setRestoreNote(null);
                setToast("Original draft restored");
              }}
            >
              Restore draft
            </button>
          </div>
        </Dialog>
      )}
      <div
        className={`toast ${toast ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <>
            <Check size={15} />
            {toast}
            <button
              className="icon-button"
              type="button"
              onClick={() => setToast("")}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </>
        )}
      </div>
    </>
  );
}
