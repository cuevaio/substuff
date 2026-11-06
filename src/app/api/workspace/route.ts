import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { deliveries, importJobs, workspaces } from "@/db/schema";
import { readAccountSession as readSession } from "@/lib/account-session";
import { workspaceSchema } from "@/lib/content";
import { noteChanged, noteUpdateError } from "@/lib/note-state";
import { sameOrigin } from "@/lib/session";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  if (!process.env.DATABASE_URL)
    return NextResponse.json({ storage: "local" }, { headers });
  try {
    const workspace = await readSession();
    return NextResponse.json(
      {
        storage: "cloud",
        document: workspace?.document ?? null,
        revision: workspace?.revision ?? 0,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Your workspace couldn’t be opened. Try again in a moment." },
      { status: 503, headers },
    );
  }
}

const update = z.object({
  revision: z.number().int().nonnegative(),
  document: workspaceSchema,
});

export async function PUT(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Open substuff to save your writing." },
      { status: 403 },
    );
  if (!process.env.DATABASE_URL)
    return NextResponse.json(
      { error: "Cloud storage is unavailable." },
      { status: 503 },
    );
  const text = await request.text();
  if (text.length > 2000000)
    return NextResponse.json(
      {
        error:
          "Your workspace is full. Export a copy before adding more articles.",
      },
      { status: 413 },
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid workspace." }, { status: 400 });
  }
  const input = update.safeParse(parsed);
  if (!input.success)
    return NextResponse.json(
      { error: "This workspace couldn’t be saved." },
      { status: 400 },
    );
  try {
    const workspace = await readSession();
    if (!workspace)
      return NextResponse.json(
        { error: "Continue with Buffer to open your workspace." },
        { status: 401, headers },
      );
    const receipts = await db()
      .select()
      .from(deliveries)
      .where(eq(deliveries.workspaceId, workspace.id));
    const error = noteUpdateError(
      workspace.document.articles,
      input.data.document.articles,
      receipts,
    );
    if (error) return NextResponse.json({ error }, { status: 409, headers });
    if (
      input.data.revision === workspace.revision &&
      workspace.document.articles.length > 0 &&
      input.data.document.articles.length === 0
    ) {
      // Clearing writing also removes resumable copies and stops unsent import jobs.
      // Delivery receipts remain so a previously sent version is never duplicated.
      await db()
        .update(importJobs)
        .set({
          state: "removed",
          article: null,
          autoVersion: null,
          error: null,
        })
        .where(eq(importJobs.workspaceId, workspace.id));
    }
    const [saved] = await db()
      .update(workspaces)
      .set({
        document: input.data.document,
        revision: workspace.revision + 1,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 86400000),
      })
      .where(
        and(
          eq(workspaces.id, workspace.id),
          eq(workspaces.revision, input.data.revision),
          ...workspace.document.articles.flatMap((article) =>
            article.notes.flatMap((note) => {
              const next = input.data.document.articles
                .find((item) => item.id === article.id)
                ?.notes.find((item) => item.id === note.id);
              if (!next || !noteChanged(note, next)) return [];
              return [
                sql`not exists (select 1 from ${deliveries} where ${deliveries.workspaceId} = ${workspace.id} and ${deliveries.articleId} = ${article.id} and ${deliveries.noteId} = ${note.id} and (${deliveries.status} in ('sent', 'scheduled', 'draft', 'sending', 'creating', 'unknown', 'needs_approval') or (${deliveries.status} = 'error' and ${deliveries.bufferPostId} is not null)))`,
              ];
            }),
          ),
        ),
      )
      .returning({ revision: workspaces.revision });
    if (!saved)
      return NextResponse.json(
        {
          error:
            "Another tab changed this workspace. Your local edits are safe. Export them before refreshing.",
        },
        { status: 409 },
      );
    return NextResponse.json(saved, { headers });
  } catch {
    return NextResponse.json(
      { error: "Cloud save paused. Your edits are backed up on this device." },
      { status: 503 },
    );
  }
}
