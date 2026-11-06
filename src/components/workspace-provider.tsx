"use client";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Note } from "@/lib/content";
import { workspaceSchema } from "@/lib/content";

type Document = ReturnType<typeof workspaceSchema.parse>;
type Workspace = {
  document: Document;
  updateNote: (
    articleId: string,
    noteId: string,
    changes: Partial<Note>,
  ) => void;
  setActive: (id: string) => void;
  flush: () => Promise<void>;
  applyServer: (document: Document, revision: number) => void;
  clear: () => Promise<void>;
  saveState: "saved" | "saving" | "unavailable";
  error: string;
};
const Context = createContext<Workspace | null>(null);
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("Workspace layout missing");
  return context;
}

export function WorkspaceProvider({
  initialDocument,
  initialRevision,
  children,
}: {
  initialDocument: Document;
  initialRevision: number;
  children: React.ReactNode;
}) {
  const [document, setDocument] = useState(initialDocument);
  const [saveState, setSaveState] = useState<Workspace["saveState"]>("saved");
  const [error, setError] = useState("");
  const current = useRef({
    document: initialDocument,
    revision: initialRevision,
  });
  const saved = useRef(JSON.stringify(initialDocument));
  const queue = useRef(Promise.resolve());
  const paused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const client = useQueryClient();
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const operation = queue.current.then(async () => {
      if (paused.current)
        throw new Error(
          "Saving is paused. Reload before sharing; your local backup is preserved.",
        );
      const snapshot = current.current.document;
      const serialized = JSON.stringify(snapshot);
      if (serialized === saved.current) return;
      setSaveState("saving");
      try {
        localStorage.setItem("substuff.workspace.v1", serialized);
      } catch {
        /* Cloud remains authoritative. */
      }
      const response = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: snapshot,
          revision: current.current.revision,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Couldn’t save your writing.");
      current.current.revision = data.revision;
      saved.current = serialized;
      setSaveState(
        JSON.stringify(current.current.document) === serialized
          ? "saved"
          : "saving",
      );
    });
    queue.current = operation.catch((cause) => {
      paused.current = true;
      setSaveState("unavailable");
      setError(cause instanceof Error ? cause.message : "Saving is paused.");
    });
    return operation;
  }, []);
  useEffect(() => {
    current.current.document = document;
    try {
      localStorage.setItem("substuff.workspace.v1", JSON.stringify(document));
    } catch {
      /* Never block server saving. */
    }
    if (JSON.stringify(document) === saved.current) return;
    setSaveState("saving");
    timer.current = setTimeout(() => {
      void flush().catch(() => {});
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [document, flush]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(current.current.document) !== saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, []);
  function change(update: (document: Document) => Document) {
    setDocument((previous) => {
      const next = update(previous);
      current.current.document = next;
      return next;
    });
  }
  function applyServer(document: Document, revision: number) {
    const parsed = workspaceSchema.parse(document);
    current.current = { document: parsed, revision };
    saved.current = JSON.stringify(parsed);
    setDocument(parsed);
    setSaveState("saved");
    void client.invalidateQueries({ queryKey: ["feed"] });
    void client.invalidateQueries({ queryKey: ["schedule"] });
  }
  return (
    <Context.Provider
      value={{
        document,
        flush,
        applyServer,
        saveState,
        error,
        setActive: (id) =>
          change((document) =>
            document.activeId === id ? document : { ...document, activeId: id },
          ),
        updateNote: (articleId, noteId, changes) =>
          change((document) => ({
            ...document,
            articles: document.articles.map((article) =>
              article.id === articleId
                ? {
                    ...article,
                    notes: article.notes.map((note) =>
                      note.id === noteId ? { ...note, ...changes } : note,
                    ),
                  }
                : article,
            ),
          })),
        clear: async () => {
          await flush();
          const next = { version: 1 as const, activeId: "", articles: [] };
          current.current.document = next;
          setDocument(next);
          await flush();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
