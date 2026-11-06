import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { deliveries, workspaces } from "@/db/schema";
import { BufferError, graphql } from "./buffer";
import type { Article, Note } from "./content";
import { deliveryKey } from "./delivery";
import { canSendThroughBuffer, noteAttachment } from "./note-attachment";
import { noteVersion } from "./note-state";

// Shared durable send boundary. Never replay a claim, even when confirmation is lost.
export async function sendNote(input: {
  workspaceId: string;
  article: Article;
  note: Note;
  channelId: string;
  token: string;
  mode: "draft" | "schedule" | "now";
  dueAt?: string;
}) {
  const { workspaceId, article, note, channelId, token, mode, dueAt } = input;
  const [posted] = await db()
    .select()
    .from(deliveries)
    .where(
      and(
        eq(deliveries.workspaceId, workspaceId),
        eq(deliveries.articleId, article.id),
        eq(deliveries.noteId, note.id),
        eq(deliveries.status, "sent"),
      ),
    )
    .limit(1);
  if (posted) return posted;
  if (!canSendThroughBuffer(note))
    throw new BufferError(
      "This is an older formatted draft. Choose Edit and approve it as plain text before sending.",
      409,
    );
  if (
    !note.approved ||
    !note.text.trim() ||
    note.text.length > 10000 ||
    (article.mode === "sample" && mode !== "draft")
  )
    throw new BufferError("This Note isn’t approved for publication.", 409);
  const requestKey = deliveryKey(
    workspaceId,
    channelId,
    article.id,
    note.id,
    noteVersion(note),
  );
  const [claim] = await db()
    .insert(deliveries)
    .values({
      id: randomUUID(),
      workspaceId,
      requestKey,
      articleId: article.id,
      noteId: note.id,
      channelId,
      text: note.text,
      includeArticle: note.includeArticle !== false,
      attachmentUrl:
        note.includeArticle !== false ? article.sourceUrl || null : null,
      mode,
      dueAt: dueAt ? new Date(dueAt) : null,
    })
    .onConflictDoNothing({ target: deliveries.requestKey })
    .returning();
  if (!claim) {
    const [existing] = await db()
      .select()
      .from(deliveries)
      .where(eq(deliveries.requestKey, requestKey));
    return existing;
  }
  try {
    const [fresh] = await db()
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));
    const current = fresh?.document.articles
      .find((item) => item.id === article.id)
      ?.notes.find((item) => item.id === note.id);
    if (!current?.approved || noteVersion(current) !== noteVersion(note)) {
      const [cancelled] = await db()
        .update(deliveries)
        .set({ status: "cancelled", error: "The Note changed before sending." })
        .where(eq(deliveries.id, claim.id))
        .returning();
      return cancelled;
    }
    const postInput = {
      channelId,
      text: note.text,
      schedulingType: "automatic",
      mode:
        mode === "now"
          ? "shareNow"
          : mode === "draft"
            ? "addToQueue"
            : "customScheduled",
      saveToDraft: mode === "draft",
      ...(mode === "schedule" ? { dueAt } : {}),
      aiAssisted: article.mode === "ai",
      source: "substuff",
      ...noteAttachment(article, note),
    };
    const { createPost } = await graphql<{
      createPost: {
        __typename: string;
        post?: { id: string; status: string; dueAt: string | null };
      };
    }>(
      token,
      "mutation($input: CreatePostInput!) { createPost(input: $input) { __typename ... on PostActionSuccess { post { id status dueAt } } ... on MutationError { message } } }",
      { input: postInput },
      true,
    );
    const remote = createPost.post;
    const values =
      createPost.__typename === "PostActionSuccess" && remote
        ? {
            bufferPostId: remote.id,
            status: remote.status,
            dueAt: remote.dueAt ? new Date(remote.dueAt) : null,
          }
        : {
            status: "error",
            error:
              "Buffer rejected this Note. Check it in Buffer before trying a new version.",
          };
    const [saved] = await db()
      .update(deliveries)
      .set(values)
      .where(eq(deliveries.id, claim.id))
      .returning();
    return saved;
  } catch (cause) {
    const uncertain = !(cause instanceof BufferError) || cause.uncertain;
    const [saved] = await db()
      .update(deliveries)
      .set({
        status: uncertain ? "unknown" : "error",
        error: uncertain
          ? "Confirmation was lost. Check Buffer; this version won’t be sent again automatically."
          : (cause as BufferError).message,
      })
      .where(eq(deliveries.id, claim.id))
      .returning();
    return saved;
  }
}
