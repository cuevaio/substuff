import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { deliveries } from "@/db/schema";
import {
  accessToken,
  BufferError,
  graphql,
  substackChannels,
} from "@/lib/buffer";
import { approvedVersion, deliveryInput, deliveryKey } from "@/lib/delivery";
import { claimQuota } from "@/lib/generation-limit";
import { digest, readSession, sameOrigin } from "@/lib/session";

type Row = typeof deliveries.$inferSelect;
type RemotePost = {
  id: string;
  status: string;
  dueAt: string | null;
  externalLink?: string | null;
};
function receipt(row: Row) {
  return {
    id: row.id,
    articleId: row.articleId,
    noteId: row.noteId,
    status: row.status,
    mode: row.mode,
    channelId: row.channelId,
    bufferPostId: row.bufferPostId,
    dueAt: row.dueAt?.toISOString() ?? null,
    hash: digest(row.text),
    error: row.error,
  };
}
const responseHeaders = { "Cache-Control": "private, no-store" };
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const workspace = await readSession();
    if (!workspace)
      return NextResponse.json(
        { deliveries: [] },
        { headers: responseHeaders },
      );
    const articleId = new URL(request.url).searchParams.get("articleId");
    const rows = await db()
      .select()
      .from(deliveries)
      .where(
        articleId
          ? and(
              eq(deliveries.workspaceId, workspace.id),
              eq(deliveries.articleId, articleId),
            )
          : eq(deliveries.workspaceId, workspace.id),
      )
      .orderBy(desc(deliveries.createdAt))
      .limit(50);
    const shouldSync = new URL(request.url).searchParams.get("sync") === "true";
    let warning: string | null = null;
    if (
      shouldSync &&
      rows.some(
        (row) =>
          row.bufferPostId &&
          ["scheduled", "sending", "draft", "error"].includes(row.status),
      )
    ) {
      const token = await accessToken(workspace.id);
      for (const row of rows
        .filter(
          (row) =>
            row.bufferPostId &&
            ["scheduled", "sending", "draft", "error"].includes(row.status),
        )
        .slice(0, 10)) {
        try {
          const { post } = await graphql<{ post: RemotePost }>(
            token,
            "query($input: PostInput!) { post(input: $input) { id status dueAt externalLink } }",
            { input: { id: row.bufferPostId } },
          );
          row.status = post.status;
          row.dueAt = post.dueAt ? new Date(post.dueAt) : null;
          await db()
            .update(deliveries)
            .set({ status: row.status, dueAt: row.dueAt })
            .where(eq(deliveries.id, row.id));
        } catch {
          warning =
            "Some Buffer statuses couldn’t be refreshed. The last confirmed status is shown.";
        }
      }
    }
    return NextResponse.json(
      {
        deliveries: rows.map((row) => ({
          ...receipt(row),
          status:
            row.status === "creating" &&
            row.createdAt.getTime() < Date.now() - 60000
              ? "unknown"
              : row.status,
        })),
        warning,
      },
      { headers: responseHeaders },
    );
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof BufferError
            ? cause.message
            : "Publishing history couldn’t be loaded.",
      },
      { status: cause instanceof BufferError ? cause.status : 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Open substuff to send Notes." },
      { status: 403 },
    );
  let input: ReturnType<typeof deliveryInput.parse>;
  try {
    const raw = await request.text();
    if (raw.length > 12000) throw new Error("input");
    input = deliveryInput.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      {
        error:
          "Choose approved Notes, a Substack channel, and valid publishing times.",
      },
      { status: 400 },
    );
  }
  try {
    const workspace = await readSession();
    if (!workspace)
      return NextResponse.json(
        { error: "Your workspace expired. Reconnect Buffer to continue." },
        { status: 401 },
      );
    const article = workspace.document.articles.find(
      (article) => article.id === input.articleId,
    );
    if (article?.mode === "sample" && input.mode === "schedule")
      return NextResponse.json(
        {
          error:
            "Use your own writing to schedule public Notes. Samples can only be saved as drafts.",
        },
        { status: 400 },
      );
    const notes = input.notes.map((selected) =>
      approvedVersion(article, selected.id, selected.hash),
    );
    if (notes.some((note) => !note))
      return NextResponse.json(
        {
          error:
            "A Note changed or isn’t approved. Save your edits, then review again.",
        },
        { status: 409 },
      );
    if (!(await claimQuota(request, "publish", 100)))
      return NextResponse.json(
        {
          error:
            "Today’s sending limit has been reached. Your drafts are safe.",
        },
        { status: 429 },
      );
    const { channels } = await substackChannels(workspace.id);
    const channel = channels.find((channel) => channel.id === input.channelId);
    if (
      !channel ||
      channel.isDisconnected ||
      channel.isLocked ||
      !channel.allowedActions.includes("scheduleUpdates")
    )
      return NextResponse.json(
        {
          error:
            "This Substack channel can’t accept posts. Check its connection and your Buffer permissions.",
        },
        { status: 400 },
      );
    if (input.mode === "schedule" && channel.isQueuePaused)
      return NextResponse.json(
        {
          error:
            "This channel is paused in Buffer. Resume it there before scheduling.",
        },
        { status: 409 },
      );
    const token = await accessToken(workspace.id);
    const results: ReturnType<typeof receipt>[] = [];
    for (const [index, note] of notes.entries()) {
      if (!note) continue;
      const requestKey = deliveryKey(
        workspace.id,
        channel.id,
        input.articleId,
        note.id,
        note.text,
      );
      const [claim] = await db()
        .insert(deliveries)
        .values({
          id: randomUUID(),
          workspaceId: workspace.id,
          requestKey,
          articleId: input.articleId,
          noteId: note.id,
          channelId: channel.id,
          text: note.text,
          mode: input.mode,
          dueAt: input.notes[index].dueAt
            ? new Date(input.notes[index].dueAt)
            : null,
        })
        .onConflictDoNothing({ target: deliveries.requestKey })
        .returning();
      if (!claim) {
        const [existing] = await db()
          .select()
          .from(deliveries)
          .where(eq(deliveries.requestKey, requestKey));
        if (existing) results.push(receipt(existing));
        continue;
      }
      try {
        const inputPost = {
          channelId: channel.id,
          text: note.text,
          schedulingType: "automatic",
          mode: input.mode === "draft" ? "addToQueue" : "customScheduled",
          saveToDraft: input.mode === "draft",
          ...(input.mode === "schedule"
            ? { dueAt: input.notes[index].dueAt }
            : {}),
          aiAssisted: article?.mode === "ai",
          source: "substuff",
        };
        const { createPost } = await graphql<{
          createPost: {
            __typename: string;
            post?: RemotePost;
            message?: string;
          };
        }>(
          token,
          "mutation($input: CreatePostInput!) { createPost(input: $input) { __typename ... on PostActionSuccess { post { id status dueAt } } ... on MutationError { message } } }",
          { input: inputPost },
          true,
        );
        if (createPost.__typename !== "PostActionSuccess" || !createPost.post) {
          const [saved] = await db()
            .update(deliveries)
            .set({
              status: "error",
              error:
                "Buffer rejected this Note. Check the channel, limits, and content in Buffer before making a new draft.",
            })
            .where(eq(deliveries.id, claim.id))
            .returning();
          results.push(receipt(saved));
          continue;
        }
        const remote = createPost.post;
        const [saved] = await db()
          .update(deliveries)
          .set({
            bufferPostId: remote.id,
            status: remote.status,
            dueAt: remote.dueAt ? new Date(remote.dueAt) : null,
          })
          .where(eq(deliveries.id, claim.id))
          .returning();
        results.push(receipt(saved));
      } catch (cause) {
        const uncertain = !(cause instanceof BufferError) || cause.uncertain;
        const [saved] = await db()
          .update(deliveries)
          .set({
            status: uncertain ? "unknown" : "error",
            error: uncertain
              ? "Buffer didn’t confirm this request. Check Buffer before sending this version again; substuff won’t automatically retry it."
              : (cause as BufferError).message,
          })
          .where(eq(deliveries.id, claim.id))
          .returning();
        results.push(receipt(saved));
      }
    }
    return NextResponse.json(
      { deliveries: results },
      { headers: responseHeaders },
    );
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof BufferError
            ? cause.message
            : "The request couldn’t be completed. Refresh publishing history before trying again.",
      },
      { status: cause instanceof BufferError ? cause.status : 503 },
    );
  }
}
