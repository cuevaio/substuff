import type { Article, Note } from "./content";

export type NoteDelivery = {
  articleId: string;
  noteId: string;
  status: string;
  text?: string;
  attachmentUrl?: string | null;
  id?: string;
  bufferPostId?: string | null;
};
export function noteState(note: Note, receipts: NoteDelivery[]) {
  if (
    receipts.some(
      (receipt) => receipt.noteId === note.id && receipt.status === "sent",
    )
  )
    return "posted" as const;
  if (
    receipts.some(
      (receipt) =>
        receipt.noteId === note.id &&
        (lockedDelivery(receipt.status) ||
          (receipt.status === "error" && receipt.bufferPostId)),
    )
  )
    return "approved" as const;
  return note.approved ? ("approved" as const) : ("to-approve" as const);
}
export function noteVersion(note: Pick<Note, "text" | "includeArticle">) {
  // Retain legacy fingerprints for the default, so existing versions cannot resend.
  return note.includeArticle === false
    ? JSON.stringify({ text: note.text, includeArticle: false })
    : note.text;
}
export const lockedDelivery = (status: string) =>
  [
    "sent",
    "scheduled",
    "draft",
    "sending",
    "creating",
    "unknown",
    "needs_approval",
  ].includes(status);
function body(note: Note) {
  return JSON.stringify({
    text: note.text,
    original: note.original,
    source: note.source,
    richText: canonical(note.richText),
    includeArticle: note.includeArticle !== false,
  });
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, canonical(value)]),
    );
  return value;
}
export function noteChanged(before: Note, after: Note) {
  return body(before) !== body(after) || before.approved !== after.approved;
}
export function noteUpdateError(
  before: Article[],
  after: Article[],
  receipts: NoteDelivery[],
): string | null {
  for (const article of before)
    for (const note of article.notes) {
      const next = after
        .find((item) => item.id === article.id)
        ?.notes.find((item) => item.id === note.id);
      if (!next) continue; // Clearing saved writing never deletes its remote receipts.
      const own = receipts.filter(
        (receipt) =>
          receipt.articleId === article.id && receipt.noteId === note.id,
      );
      const changed = body(note) !== body(next);
      if (
        own.some((receipt) => receipt.status === "sent") &&
        (changed || note.approved !== next.approved)
      )
        return "Posted Notes are read-only.";
      if (
        (changed || (note.approved && !next.approved)) &&
        own.some(
          (receipt) =>
            lockedDelivery(receipt.status) ||
            (receipt.status === "error" && receipt.bufferPostId),
        )
      )
        return "This Note has an active Buffer delivery. Cancel it before editing; an in-flight send may finish.";
      if (changed && note.approved && next.approved)
        return "Choose Edit before changing an approved Note.";
    }
  return null;
}
