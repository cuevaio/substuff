"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Italic,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  Strikethrough,
} from "lucide-react";
import { useEffect } from "react";
import type { Note } from "@/lib/content";
import { plainDocument, type RichNode, richTextToPlain } from "@/lib/rich-text";

export function NoteEditor({
  note,
  onChange,
}: {
  note: Note;
  onChange: (changes: Pick<Note, "text" | "richText">) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        link: false,
        underline: false,
      }),
    ],
    immediatelyRender: false,
    content: note.richText || plainDocument(note.text),
    editorProps: {
      attributes: {
        class: "rich-note prose",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Edit Note",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      const richText = editor.getJSON() as RichNode;
      onChange({ text: richTextToPlain(richText), richText });
    },
  });
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            strike: editor.isActive("strike"),
            code: editor.isActive("code"),
            bulletList: editor.isActive("bulletList"),
            orderedList: editor.isActive("orderedList"),
            blockquote: editor.isActive("blockquote"),
            codeBlock: editor.isActive("codeBlock"),
          }
        : null,
  });
  useEffect(() => {
    if (!editor) return;
    const next = note.richText || plainDocument(note.text);
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(next))
      editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, note.text, note.richText]);
  if (!editor) return <div className="rich-note">{note.text}</div>;
  const tools = [
    {
      name: "Bold",
      key: "bold",
      icon: Bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      name: "Italic",
      key: "italic",
      icon: Italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      name: "Strikethrough",
      key: "strike",
      icon: Strikethrough,
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      name: "Inline code",
      key: "code",
      icon: Code,
      run: () => editor.chain().focus().toggleCode().run(),
    },
    {
      name: "Bullet list",
      key: "bulletList",
      icon: List,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      name: "Numbered list",
      key: "orderedList",
      icon: ListOrdered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      name: "Quote",
      key: "blockquote",
      icon: Quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      name: "Code block",
      key: "codeBlock",
      icon: SquareCode,
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
  ] as const;
  return (
    <div className="note-composer">
      <div
        className="format-toolbar"
        role="toolbar"
        aria-label="Note formatting"
      >
        {tools.map((tool) => (
          <button
            key={tool.key}
            type="button"
            className="icon-button"
            aria-label={tool.name}
            title={tool.name}
            aria-pressed={state?.[tool.key] || false}
            onMouseDown={(event) => event.preventDefault()}
            onClick={tool.run}
          >
            <tool.icon size={15} />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
