"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  LoaderCircle,
  Menu,
  Plus,
  RotateCcw,
  Settings2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BufferPanel, BufferPreferences } from "@/components/buffer-panel";
import { Dialog } from "@/components/dialog";
import { Button } from "@/components/ui/button";
import {
  type Article,
  articleInput,
  exportNotes,
  extractNotes,
  generatedNotes,
  type Note,
  sampleArticle,
  workspaceSchema,
} from "@/lib/content";

const STORAGE = "substuff.workspace.v1";
type Modal = "article" | "review" | "settings" | null;
type SaveState = "saved" | "saving" | "unavailable";

function Mark() {
  return (
    <svg
      width="23"
      height="26"
      viewBox="0 0 28 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M22 5H11a7 7 0 0 0 0 14h6a4 4 0 0 1 0 8H5M23 11H11a1 1 0 0 0 0 2h6a10 10 0 0 1 0 20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
  const [loaded, setLoaded] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeId, setActiveId] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [modal, setModal] = useState<Modal>(null);
  const [tab, setTab] = useState<"notes" | "source">("notes");
  const [filter, setFilter] = useState<"all" | "approved">("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
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
          "Cloud storage is unavailable. Working from this device’s backup.",
        );
      }
      setLoaded(true);
    }
    void restore();
    fetch("/api/generate")
      .then((r) => r.json())
      .then((data) => setAiAvailable(data.available === true))
      .catch(() => {});
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
                : "Cloud save paused. Export a copy of your edits.",
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
        "Cloud save is paused. Export your edits and reload before connecting or sending.",
      );
    const document = { version: 1 as const, articles, activeId };
    try {
      localStorage.setItem(STORAGE, JSON.stringify(document));
    } catch {
      /* Cloud save can still succeed. */
    }
    const operation = saveQueue.current.then(async () => {
      if (cloudPaused.current)
        throw new Error(
          "Cloud save is paused. Export a copy before reloading.",
        );
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
        cause instanceof Error ? cause.message : "Cloud save paused.",
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
    setSidebarOpen(false);
  }

  function addArticle(next: Article) {
    setArticles((previous) => [
      next,
      ...previous.filter((a) => a.id !== next.id),
    ]);
    selectArticle(next.id);
    setModal(null);
    setTitle("");
    setContent("");
    setError("");
  }

  function openArticle() {
    setError("");
    setModal("article");
    setSidebarOpen(false);
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

  async function createArticle(useAI: boolean) {
    const input = articleInput.safeParse({ title, content });
    if (!input.success) {
      setError(input.error.issues[0].message);
      return;
    }
    setError("");
    setGenerating(true);
    try {
      let notes: Note[];
      if (useAI) {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input.data),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || "We couldn’t create Notes. Please try again.",
          );
        notes = generatedNotes.parse(data).notes.map((n, index) => ({
          ...n,
          id: `note-${index}`,
          original: n.text,
          approved: false,
        }));
      } else notes = extractNotes(input.data.content);
      addArticle({
        id: crypto.randomUUID(),
        ...input.data,
        notes,
        createdAt: new Date().toISOString(),
        mode: useAI ? "ai" : "excerpts",
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong. Your article is still here.",
      );
    } finally {
      setGenerating(false);
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
            <a href="/" className="brand" aria-label="substuff home">
              <Mark />
              <span>substuff</span>
            </a>
            <span className="quiet">A little more from your writing.</span>
          </header>
          <main id="main" className="welcome">
            <div className="welcome-copy">
              <span className="eyebrow">FOR THE WRITERS</span>
              <h1>
                Your writing,
                <br />
                <span className="welcome-title-second">continued.</span>
              </h1>
              <p>
                Turn an article into a few good Notes.
                <br className="desktop-break" /> Make them yours. Find your
                rhythm.
              </p>
              <Button onClick={openArticle}>
                Start with an article <ArrowRight size={17} />
              </Button>
              <button
                type="button"
                className="text-button sample-link"
                onClick={loadSample}
              >
                Or take a look around <ArrowUpRight size={15} />
              </button>
              <span className="welcome-footnote">
                No account needed. Nothing posts without you.
              </span>
            </div>
            <div
              className="welcome-preview"
              role="img"
              aria-label="Example of an article becoming a Note"
            >
              <div className="preview-source">
                <div className="preview-meta">
                  <FileText size={15} />
                  <span>From your article</span>
                </div>
                <h2>
                  A little less,
                  <br />a little better
                </h2>
                <p>
                  We talk about consistency as if it means doing more, more
                  often. I’m beginning to think it means making fewer promises
                  and keeping them.
                </p>
                <div className="faded-lines">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="preview-connector">
                <span />
                <ArrowDownToLine size={17} />
                <span />
              </div>
              <div className="preview-note">
                <div className="preview-meta">
                  <Mark />
                  <span>A thought worth sharing</span>
                </div>
                <p>
                  Maybe consistency isn’t doing more, more often.
                  <br />
                  <br />
                  Maybe it’s making fewer promises and keeping them.
                </p>
                <div className="preview-bottom">
                  <span>Still sounds like you.</span>
                  <Check size={16} />
                </div>
              </div>
            </div>
          </main>
          <footer className="welcome-footer">
            <span>Less starting over. More showing up.</span>
            <span>Made for your words, not more noise.</span>
          </footer>
        </div>
      ) : (
        <div className="app-shell">
          {sidebarOpen && (
            <button
              className="sidebar-scrim"
              type="button"
              aria-label="Close navigation"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <aside
            className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}
            aria-label="Article navigation"
          >
            <a href="/" className="brand" aria-label="substuff home">
              <Mark />
              <span>substuff</span>
            </a>
            <button type="button" className="new-article" onClick={openArticle}>
              <Plus size={17} /> Add an article
            </button>
            <div className="sidebar-label">YOUR WRITING</div>
            <nav className="article-nav">
              {articles.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={
                    article.id === a.id ? "article-link active" : "article-link"
                  }
                  onClick={() => selectArticle(a.id)}
                  aria-current={article.id === a.id ? "page" : undefined}
                >
                  <FileText size={16} />
                  <span>{a.title}</span>
                  <ChevronRight size={13} />
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <span className="connection-label">
                <span className="status-dot" />{" "}
                {cloud ? "Private workspace" : "Local workspace"}
              </span>
              <button
                className="sidebar-settings"
                type="button"
                onClick={() => {
                  setModal("settings");
                  setSidebarOpen(false);
                }}
              >
                <Settings2 size={16} /> Preferences
              </button>
            </div>
          </aside>
          <div className="workspace">
            <header className="workspace-header">
              <div className="breadcrumb">
                <button
                  className="icon-button mobile-menu"
                  type="button"
                  aria-label="Open navigation"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu size={19} />
                </button>
                <span>Your writing</span>
                <ChevronRight size={13} />
                <span>{article.title}</span>
              </div>
              <span className="save-state" role="status">
                {saveState === "saving" ? (
                  "Saving…"
                ) : saveState === "unavailable" ? (
                  "Save paused · export a copy"
                ) : (
                  <>
                    <Check size={13} />{" "}
                    {cloud && !cloudPaused.current
                      ? "All changes saved"
                      : "Saved on this device"}
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
                <div className="article-context">
                  {article.mode === "sample"
                    ? "SAMPLE ARTICLE"
                    : article.mode === "excerpts"
                      ? "SOURCE EXCERPTS"
                      : "YOUR ARTICLE"}
                  <span>·</span>
                  {article.notes.length} Notes
                </div>
                <h1>{article.title}</h1>
                <p>
                  {article.mode === "excerpts"
                    ? "Passages from your article. Shape them into Notes, in your own words."
                    : "A few thoughts from your article. Make them yours."}
                </p>
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
                    Original article
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
                          <span>{note.angle}</span>
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
                            Source passage
                            <ChevronDown
                              size={12}
                              className={sourceId === note.id ? "rotated" : ""}
                            />
                          </button>
                          <div>
                            <span className="character-count">
                              {note.text.length.toLocaleString()} characters
                            </span>
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
                <span>Good Notes start with your point of view.</span>
                {article.mode === "sample" && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={openArticle}
                  >
                    Try your own article <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </main>
            <footer className="review-bar">
              <div>
                <span className="review-count">
                  {approved.length
                    ? `${approved.length} of ${article.notes.length} approved`
                    : "Take a moment. Make them yours."}
                </span>
                <span className="review-caption">
                  {approved.length
                    ? "Only approved Notes move forward."
                    : "Approve the thoughts you want to share."}
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
        </div>
      )}

      {modal === "article" && (
        <Dialog
          title="Start with your words."
          wide
          onClose={() => {
            if (!generating) setModal(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void createArticle(aiAvailable);
            }}
            className="article-form"
          >
            <p className="dialog-description">
              Paste an article you wrote. We’ll find a few thoughts worth
              sharing.
            </p>
            <label htmlFor="article-title">Article title</label>
            <input
              id="article-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What’s your article called?"
              maxLength={180}
              disabled={generating}
              required
            />
            <label htmlFor="article-content">Your article</label>
            <textarea
              id="article-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="The whole piece, or a section you want to share…"
              maxLength={60000}
              disabled={generating}
              required
            />
            <div className="input-caption">
              <span>{content.length.toLocaleString()} / 60,000 characters</span>
              <span>At least 200 characters</span>
            </div>
            {error && (
              <p role="alert" className="inline-error">
                {error}
              </p>
            )}
            <p className="privacy-note">
              {aiAvailable
                ? "Creating Notes sends your article through Vercel AI Gateway to Google Gemini, with OpenAI as a fallback. Only use writing you have permission to share."
                : "AI writing isn’t connected in this preview. Start with exact excerpts and edit them yourself."}{" "}
              {cloud
                ? "Your drafts are stored privately for this browser’s workspace, with a local backup."
                : "Drafts stay on this device."}
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => setModal(null)}
                disabled={generating}
              >
                Cancel
              </button>
              <div>
                {aiAvailable && error && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={generating}
                    onClick={() => createArticle(false)}
                  >
                    Use excerpts instead
                  </button>
                )}
                <button
                  type="submit"
                  className="button primary"
                  disabled={
                    generating || !title.trim() || content.trim().length < 200
                  }
                >
                  {generating ? (
                    <>
                      <LoaderCircle className="spinner" size={16} /> Finding
                      your Notes…
                    </>
                  ) : (
                    <>
                      {aiAvailable ? "Create Notes" : "Start with excerpts"}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </Dialog>
      )}

      {modal === "review" && article && (
        <Dialog title="Ready when you are." onClose={() => setModal(null)}>
          <BufferPanel
            article={article}
            beforeSend={flushWorkspace}
            onExport={download}
          />
        </Dialog>
      )}

      {modal === "settings" && (
        <Dialog
          title="Your workspace."
          onClose={() => {
            setModal(null);
            setConfirmClear(false);
          }}
        >
          <div className="settings-row">
            <span>Storage</span>
            <p>
              {cloud
                ? "Drafts are saved privately in Neon, with a backup on this device. This browser keeps access for 30 days; connecting the same Buffer account can recover your workspace on another device."
                : "Articles and edits stay in this browser. They aren’t synced across devices. Export anything you want to keep."}
            </p>
          </div>
          <div className="settings-row">
            <span>AI writing</span>
            <p>
              {aiAvailable
                ? "Connected through Vercel AI Gateway. Gemini Flash Lite creates drafts, with GPT-4.1 mini as a fallback. Only runs when you choose Create Notes."
                : "Not connected. Configure AI Gateway and Neon to enable article-to-Notes writing. Excerpts work without them."}
            </p>
          </div>
          <div className="settings-row">
            <span>Buffer</span>
            <BufferPreferences beforeConnect={flushWorkspace} />
          </div>
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
                This removes every article and edit from this workspace. Export
                your approved Notes first. It does not cancel posts already in
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
                Delete articles and edits
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
