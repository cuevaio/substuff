"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronRight, Copy, FileText, LoaderCircle, Menu, Plus, RotateCcw, Settings2, X } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Article, Note, articleInput, exportNotes, extractNotes, generatedNotes, sampleArticle, workspaceSchema } from "@/lib/content";

const STORAGE = "substuff.workspace.v1";
type Modal = "article" | "review" | "settings" | null;
type SaveState = "saved" | "saving" | "unavailable";

function Mark() {
  return <svg width="23" height="26" viewBox="0 0 28 32" fill="none" aria-hidden="true"><path d="M22 5H11a7 7 0 0 0 0 14h6a4 4 0 0 1 0 8H5M23 11H11a1 1 0 0 0 0 2h6a10 10 0 0 1 0 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function AutoTextarea({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const field = ref.current;
    if (field) { field.style.height = "0px"; field.style.height = `${field.scrollHeight + 2}px`; }
  }, [value]);
  return <textarea ref={ref} className="note-editor" value={value} aria-label={label} maxLength={10000} spellCheck onChange={event => onChange(event.target.value)} />;
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

  const article = articles.find(a => a.id === activeId) ?? articles[0];
  const approved = article?.notes.filter(n => n.approved) ?? [];
  const visibleNotes = article?.notes.filter(n => filter !== "approved" || n.approved) ?? [];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const data = workspaceSchema.parse(JSON.parse(raw));
        setArticles(data.articles); setActiveId(data.activeId);
      }
    } catch { setSaveState("unavailable"); }
    setLoaded(true);
    fetch("/api/generate").then(r => r.json()).then(data => setAiAvailable(data.available === true)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE, JSON.stringify({ version: 1, articles, activeId }));
        setSaveState("saved");
      } catch { setSaveState("unavailable"); }
    }, 350);
    return () => clearTimeout(timeout);
  }, [articles, activeId, loaded]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  function selectArticle(id: string) {
    setActiveId(id); setTab("notes"); setFilter("all"); setSourceId(null); setSidebarOpen(false);
  }

  function addArticle(next: Article) {
    setArticles(previous => [next, ...previous.filter(a => a.id !== next.id)]);
    selectArticle(next.id); setModal(null); setTitle(""); setContent(""); setError("");
  }

  function openArticle() { setError(""); setModal("article"); setSidebarOpen(false); }

  function loadSample() {
    const existing = articles.find(a => a.id === sampleArticle.id);
    if (existing) selectArticle(existing.id);
    else addArticle(structuredClone(sampleArticle));
  }

  function updateNote(id: string, changes: Partial<Note>) {
    if (!article) return;
    setArticles(previous => previous.map(a => a.id !== article.id ? a : {
      ...a, notes: a.notes.map(n => n.id !== id ? n : { ...n, ...changes }),
    }));
  }

  async function createArticle(useAI: boolean) {
    const input = articleInput.safeParse({ title, content });
    if (!input.success) { setError(input.error.issues[0].message); return; }
    setError(""); setGenerating(true);
    try {
      let notes: Note[];
      if (useAI) {
        const response = await fetch("/api/generate", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "We couldn’t create Notes. Please try again.");
        notes = generatedNotes.parse(data).notes.map((n, index) => ({
          ...n, id: `note-${index}`, original: n.text, approved: false,
        }));
      } else notes = extractNotes(input.data.content);
      addArticle({ id: crypto.randomUUID(), ...input.data, notes, createdAt: new Date().toISOString(), mode: useAI ? "ai" : "excerpts" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong. Your article is still here."); }
    finally { setGenerating(false); }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setToast("Copied to clipboard"); }
    catch { setToast("Clipboard unavailable. Select the text and copy it instead."); }
  }

  function download() {
    if (!article || !approved.length) return;
    const url = URL.createObjectURL(new Blob([exportNotes(article)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url;
    link.download = `${article.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) || "substuff"}-notes.txt`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setToast("Approved Notes exported");
  }

  if (!loaded) return <div className="boot" aria-label="Loading substuff"><Mark /></div>;

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    {!article ? <div className="welcome-shell">
      <header className="welcome-header"><a href="/" className="brand" aria-label="substuff home"><Mark /><span>substuff</span></a><span className="quiet">A little more from your writing.</span></header>
      <main id="main" className="welcome">
        <div className="welcome-copy">
          <span className="eyebrow">FOR THE WRITERS</span>
          <h1>Your writing,<br /><span>continued.</span></h1>
          <p>Turn an article into a few good Notes.<br className="desktop-break" /> Make them yours. Find your rhythm.</p>
          <button className="button primary" onClick={openArticle}>Start with an article <ArrowRight size={17} /></button>
          <button className="text-button sample-link" onClick={loadSample}>Or take a look around <ArrowUpRight size={15} /></button>
          <span className="welcome-footnote">No account needed. Nothing posts without you.</span>
        </div>
        <div className="welcome-preview" aria-label="Example of an article becoming a Note">
          <div className="preview-source"><div className="preview-meta"><FileText size={15} /><span>From your article</span></div><h2>A little less,<br />a little better</h2><p>We talk about consistency as if it means doing more, more often. I’m beginning to think it means making fewer promises and keeping them.</p><div className="faded-lines"><i /><i /><i /></div></div>
          <div className="preview-connector"><span /><ArrowDownToLine size={17} /><span /></div>
          <div className="preview-note"><div className="preview-meta"><Mark /><span>A thought worth sharing</span></div><p>Maybe consistency isn’t doing more, more often.<br /><br />Maybe it’s making fewer promises and keeping them.</p><div className="preview-bottom"><span>Still sounds like you.</span><Check size={16} /></div></div>
        </div>
      </main>
      <footer className="welcome-footer"><span>Less starting over. More showing up.</span><span>Made for your words, not more noise.</span></footer>
    </div> : <div className="app-shell">
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`} aria-label="Article navigation">
        <a href="/" className="brand" aria-label="substuff home"><Mark /><span>substuff</span></a>
        <button className="new-article" onClick={openArticle}><Plus size={17} /> Add an article</button>
        <div className="sidebar-label">YOUR WRITING</div>
        <nav className="article-nav">{articles.map(a => <button key={a.id} className={article.id === a.id ? "article-link active" : "article-link"} onClick={() => selectArticle(a.id)} aria-current={article.id === a.id ? "page" : undefined}><FileText size={16} /><span>{a.title}</span><ChevronRight size={13} /></button>)}</nav>
        <div className="sidebar-bottom"><span className="connection-label"><span className="status-dot" /> Local workspace</span><button className="sidebar-settings" onClick={() => { setModal("settings"); setSidebarOpen(false); }}><Settings2 size={16} /> Preferences</button></div>
      </aside>
      <div className="workspace">
        <header className="workspace-header"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button><span>Your writing</span><ChevronRight size={13} /><span>{article.title}</span></div><span className="save-state" role="status">{saveState === "saving" ? "Saving…" : saveState === "unavailable" ? "Not saved · export a copy" : <><Check size={13} /> Saved on this device</>}</span></header>
        <main id="main" className="editor-main">
          <div className="article-heading"><div className="article-context">{article.mode === "sample" ? "SAMPLE ARTICLE" : article.mode === "excerpts" ? "SOURCE EXCERPTS" : "YOUR ARTICLE"}<span>·</span>{article.notes.length} Notes</div><h1>{article.title}</h1><p>{article.mode === "excerpts" ? "Passages from your article. Shape them into Notes, in your own words." : "A few thoughts from your article. Make them yours."}</p></div>
          <div className="editor-tabs"><div role="tablist" aria-label="Article view"><button id="notes-tab" role="tab" aria-controls="notes-panel" aria-selected={tab === "notes"} tabIndex={tab === "notes" ? 0 : -1} className={tab === "notes" ? "tab selected" : "tab"} onClick={() => setTab("notes")} onKeyDown={e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { setTab("source"); document.getElementById("source-tab")?.focus(); } }}>Notes <span>{article.notes.length}</span></button><button id="source-tab" role="tab" aria-controls="source-panel" aria-selected={tab === "source"} tabIndex={tab === "source" ? 0 : -1} className={tab === "source" ? "tab selected" : "tab"} onClick={() => setTab("source")} onKeyDown={e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { setTab("notes"); document.getElementById("notes-tab")?.focus(); } }}>Original article</button></div>{tab === "notes" && <button className="filter-button" aria-pressed={filter === "approved"} onClick={() => setFilter(filter === "all" ? "approved" : "all")}>{filter === "all" ? "All Notes" : "Approved"}<ChevronDown size={13} /></button>}</div>
          {tab === "notes" ? <section id="notes-panel" role="tabpanel" aria-labelledby="notes-tab" className="notes-list">
            {visibleNotes.length === 0 && <div className="empty-filter"><Check size={25} /><p>No approved Notes yet.</p><button className="text-button" onClick={() => setFilter("all")}>Back to all Notes <ArrowRight size={15} /></button></div>}
            {visibleNotes.map(note => <article className="note-row" key={note.id}>
              <div className="note-index">{String(article.notes.findIndex(n => n.id === note.id) + 1).padStart(2, "0")}</div>
              <div className="note-content"><div className="note-top"><span>{note.angle}</span><button className={`approve-button ${note.approved ? "approved" : ""}`} aria-pressed={note.approved} disabled={!note.text.trim() || note.text.length > 10000} onClick={() => updateNote(note.id, { approved: !note.approved })}><Check size={14} />{note.approved ? "Approved" : "Approve"}</button></div>
                <AutoTextarea value={note.text} label={`Edit Note ${article.notes.findIndex(n => n.id === note.id) + 1}`} onChange={text => updateNote(note.id, { text, approved: false })} />
                <div className="note-tools"><button className="source-button" aria-expanded={sourceId === note.id} onClick={() => setSourceId(sourceId === note.id ? null : note.id)}><FileText size={13} />Source passage<ChevronDown size={12} className={sourceId === note.id ? "rotated" : ""} /></button><div><span className="character-count">{note.text.length.toLocaleString()} characters</span><button className="icon-button" aria-label={`Copy Note ${article.notes.findIndex(n => n.id === note.id) + 1}`} onClick={() => copy(note.text)}><Copy size={14} /></button><button className="icon-button" disabled={note.text === note.original} aria-label={`Restore Note ${article.notes.findIndex(n => n.id === note.id) + 1}`} onClick={() => setRestoreNote(note)}><RotateCcw size={14} /></button></div></div>
                {sourceId === note.id && <blockquote className="source-passage">{note.source}</blockquote>}
              </div>
            </article>)}
          </section> : <section id="source-panel" role="tabpanel" aria-labelledby="source-tab" className="original-article">{article.content.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</section>}
          <div className="editor-end"><span>Good Notes start with your point of view.</span>{article.mode === "sample" && <button className="text-button" onClick={openArticle}>Try your own article <ArrowRight size={14} /></button>}</div>
        </main>
        <footer className="review-bar"><div><span className="review-count">{approved.length ? `${approved.length} of ${article.notes.length} approved` : "Take a moment. Make them yours."}</span><span className="review-caption">{approved.length ? "Only approved Notes move forward." : "Approve the thoughts you want to share."}</span></div><button className="button primary" disabled={!approved.length} onClick={() => setModal("review")}>Review {approved.length ? `${approved.length} ${approved.length === 1 ? "Note" : "Notes"}` : "Notes"}<ArrowRight size={16} /></button></footer>
      </div>
    </div>}

    {modal === "article" && <Dialog title="Start with your words." wide onClose={() => { if (!generating) setModal(null); }}>
      <form onSubmit={e => { e.preventDefault(); void createArticle(aiAvailable); }} className="article-form">
        <p className="dialog-description">Paste an article you wrote. We’ll find a few thoughts worth sharing.</p>
        <label htmlFor="article-title">Article title</label><input id="article-title" autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="What’s your article called?" maxLength={180} disabled={generating} required />
        <label htmlFor="article-content">Your article</label><textarea id="article-content" value={content} onChange={e => setContent(e.target.value)} placeholder="The whole piece, or a section you want to share…" maxLength={60000} disabled={generating} required />
        <div className="input-caption"><span>{content.length.toLocaleString()} / 60,000 characters</span><span>At least 200 characters</span></div>
        {error && <p role="alert" className="inline-error">{error}</p>}
        <p className="privacy-note">{aiAvailable ? "Creating Notes sends this article to OpenAI. Only use writing you have permission to share. Drafts stay on this device." : "AI writing isn’t connected in this preview. Start with exact excerpts from your article and edit them yourself. Nothing leaves this browser."}</p>
        <div className="dialog-actions"><button type="button" className="text-button" onClick={() => setModal(null)} disabled={generating}>Cancel</button><div>{aiAvailable && error && <button type="button" className="text-button" disabled={generating} onClick={() => createArticle(false)}>Use excerpts instead</button>}<button type="submit" className="button primary" disabled={generating || !title.trim() || content.trim().length < 200}>{generating ? <><LoaderCircle className="spinner" size={16} /> Finding your Notes…</> : <>{aiAvailable ? "Create Notes" : "Start with excerpts"}<ArrowRight size={16} /></>}</button></div></div>
      </form>
    </Dialog>}

    {modal === "review" && article && <Dialog title="Ready when you are." onClose={() => setModal(null)}>
      <p className="dialog-description">{approved.length} approved {approved.length === 1 ? "Note" : "Notes"} from “{article.title}”.</p>
      <ol className="approved-preview">{approved.map(note => <li key={note.id}>{note.text}</li>)}</ol>
      <div className="buffer-notice"><span className="buffer-mark">≋</span><div><span>Scheduling comes next.</span><p>Buffer isn’t connected in this build. Export your approved Notes to use them anywhere. Nothing has been scheduled.</p></div></div>
      <div className="dialog-actions"><button className="text-button" onClick={() => setModal(null)}><ArrowLeft size={15} /> Keep editing</button><button className="button primary" onClick={download}><ArrowDownToLine size={16} /> Export Notes</button></div>
    </Dialog>}

    {modal === "settings" && <Dialog title="Your workspace." onClose={() => { setModal(null); setConfirmClear(false); }}>
      <div className="settings-row"><span>Storage</span><p>Articles and edits stay in this browser. They aren’t synced across devices. Export anything you want to keep.</p></div>
      <div className="settings-row"><span>AI writing</span><p>{aiAvailable ? "Connected. Articles are sent to OpenAI only when you choose Create Notes." : "Not connected. Add OPENAI_API_KEY to the server environment to enable article-to-Notes writing. Excerpts work without it."}</p></div>
      <div className="settings-row"><span>Buffer</span><p>Not connected. OAuth and live scheduling are the next build phase.</p></div>
      <div className="dialog-actions"><button className="text-button" onClick={() => setConfirmClear(!confirmClear)}>Clear local workspace</button><button className="button secondary" onClick={() => setModal(null)}>Done</button></div>
      {confirmClear && <div className="clear-confirm"><p>This removes every article and edit from this browser. Export your approved Notes first.</p><button className="button secondary" onClick={() => { setArticles([]); setActiveId(""); setModal(null); setConfirmClear(false); setToast("Local workspace cleared"); }}>Delete local articles and edits</button></div>}
    </Dialog>}

    {restoreNote && <Dialog title="Restore this Note?" onClose={() => setRestoreNote(null)}><p className="dialog-description">Your edits to this Note will be replaced with the original draft. Other Notes won’t change.</p><div className="dialog-actions"><button className="text-button" onClick={() => setRestoreNote(null)}>Keep my edits</button><button className="button primary" onClick={() => { updateNote(restoreNote.id, { text: restoreNote.original, approved: false }); setRestoreNote(null); setToast("Original draft restored"); }}>Restore draft</button></div></Dialog>}
    <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite">{toast && <><Check size={15} />{toast}<button className="icon-button" onClick={() => setToast("")} aria-label="Dismiss notification"><X size={14} /></button></>}</div>
  </>;
}
