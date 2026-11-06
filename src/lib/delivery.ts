import { z } from "zod";
import type { Article } from "./content";
import { digest } from "./session";

export const deliveryInput = z
  .object({
    articleId: z.string().min(1).max(100),
    channelId: z.string().min(1).max(100),
    mode: z.enum(["draft", "schedule"]),
    confirmed: z.literal(true),
    notes: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          hash: z.string().regex(/^[a-f0-9]{64}$/),
          dueAt: z.string().datetime().optional(),
        }),
      )
      .min(1)
      .max(5),
  })
  .superRefine((input, context) => {
    if (new Set(input.notes.map((note) => note.id)).size !== input.notes.length)
      context.addIssue({
        code: "custom",
        message: "Choose each Note only once.",
      });
    if (
      input.mode === "schedule" &&
      input.notes.some((note) => !note.dueAt || !validSchedule(note.dueAt))
    )
      context.addIssue({
        code: "custom",
        message:
          "Choose publishing times between five minutes and 90 days from now.",
      });
  });

export function validSchedule(date: string, now = Date.now()) {
  const time = Date.parse(date);
  return (
    Number.isFinite(time) &&
    time >= now + 5 * 60000 &&
    time <= now + 90 * 86400000
  );
}

export function deliveryKey(
  workspaceId: string,
  channelId: string,
  articleId: string,
  noteId: string,
  text: string,
) {
  return digest(
    JSON.stringify([workspaceId, channelId, articleId, noteId, text]),
  );
}

export function approvedVersion(
  article: Article | undefined,
  id: string,
  hash: string,
) {
  const note = article?.notes.find((note) => note.id === id);
  return note?.approved &&
    note.text.trim() &&
    note.text.length <= 10000 &&
    digest(note.text) === hash
    ? note
    : null;
}

export type DeliveryReceipt = {
  id: string;
  articleId: string;
  noteId: string;
  status: string;
  mode: string;
  channelId: string;
  bufferPostId: string | null;
  dueAt: string | null;
  hash: string;
  error: string | null;
  externalLink?: string | null;
};
