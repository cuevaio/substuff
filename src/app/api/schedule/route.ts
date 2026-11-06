import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { deliveries } from "@/db/schema";
import { readAccountSession } from "@/lib/account-session";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const workspace = await readAccountSession();
    if (!workspace)
      return NextResponse.json(
        { error: "Sign in to see your schedule." },
        { status: 401, headers },
      );
    const cursor = Number(
      new URL(request.url).searchParams.get("cursor") || "0",
    );
    if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > 100000)
      return NextResponse.json(
        { error: "Invalid page." },
        { status: 400, headers },
      );
    const rows = await db()
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.workspaceId, workspace.id)))
      .orderBy(desc(deliveries.createdAt), desc(deliveries.id))
      .limit(101)
      .offset(cursor);
    return NextResponse.json(
      {
        items: rows.slice(0, 100).map((row) => ({
          id: row.id,
          articleId: row.articleId,
          noteId: row.noteId,
          text: row.text,
          status:
            row.status === "creating" &&
            row.createdAt.getTime() < Date.now() - 60000
              ? "unknown"
              : row.status,
          mode: row.mode,
          dueAt: row.dueAt?.toISOString() || null,
          createdAt: row.createdAt.toISOString(),
          channelId: row.channelId,
          title:
            workspace.document.articles.find(
              (article) => article.id === row.articleId,
            )?.title || "Archived post",
          bufferPostId: row.bufferPostId,
          error: row.error,
        })),
        nextCursor: rows.length > 100 ? cursor + 100 : null,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Couldn’t open your schedule." },
      { status: 503, headers },
    );
  }
}
