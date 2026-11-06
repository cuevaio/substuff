"use client";
import { useEffect, useRef } from "react";
import type { Note } from "@/lib/content";

export function NoteEditor({
  note,
  onChange,
}: {
  note: Note;
  onChange: (changes: Pick<Note, "text" | "richText">) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const field = ref.current;
    if (!field || field.value !== note.text) return;
    const resize = () => {
      field.style.height = "0px";
      field.style.height = `${field.scrollHeight + 2}px`;
    };
    resize();
    let width = field.clientWidth;
    const observer = new ResizeObserver(() => {
      if (width !== field.clientWidth) {
        width = field.clientWidth;
        resize();
      }
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, [note.text]);
  return (
    <textarea
      ref={ref}
      className="plain-note-editor"
      aria-label="Edit Note"
      value={note.text}
      maxLength={10000}
      spellCheck
      onChange={(event) =>
        onChange({ text: event.target.value, richText: undefined })
      }
    />
  );
}
