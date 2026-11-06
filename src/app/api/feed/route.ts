import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { automation, importJobs, publications } from "@/db/schema";
import { readAccountSession as readSession } from "@/lib/account-session";
import { fetchPublicationFeed } from "@/lib/feed";
import { discoverFeed } from "@/lib/feed-sync";
import { claimQuota } from "@/lib/generation-limit";
import { runImportJob } from "@/lib/import-jobs";
import { sameOrigin } from "@/lib/session";
import { parsePublicationUrl } from "@/lib/substack-url";

export const maxDuration = 180;
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const workspace = await readSession();
  if (!workspace)
    return NextResponse.json({ publication: null, jobs: [] }, { headers });
  const [publication] = await db()
    .select()
    .from(publications)
    .where(eq(publications.workspaceId, workspace.id));
  const jobs = await db()
    .select({
      sourceUrl: importJobs.sourceUrl,
      state: importJobs.state,
      error: importJobs.error,
    })
    .from(importJobs)
    .where(eq(importJobs.workspaceId, workspace.id))
    .orderBy(desc(importJobs.createdAt))
    .limit(10);
  return NextResponse.json(
    { publication: publication ?? null, jobs },
    { headers },
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Open substuff to connect a publication." },
      { status: 403 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new Error("input");
    const body = JSON.parse(raw);
    const source = parsePublicationUrl(body.url);
    const workspace = await readSession();
    if (!workspace)
      return NextResponse.json(
        { error: "Save your workspace before connecting a publication." },
        { status: 401 },
      );
    const [policy] = await db()
      .select()
      .from(automation)
      .where(eq(automation.workspaceId, workspace.id));
    if ((policy?.version ?? 0) !== body.automationVersion)
      return NextResponse.json(
        {
          error: "Approval preferences changed. Review them before connecting.",
        },
        { status: 409 },
      );
    if (!(await claimQuota(request, "feed", 40)))
      return NextResponse.json(
        { error: "Try checking your feed again tomorrow." },
        { status: 429 },
      );
    const feed = await fetchPublicationFeed(source.url);
    const [existing] = await db()
      .select()
      .from(publications)
      .where(eq(publications.workspaceId, workspace.id));
    if (existing && existing.url !== source.url)
      return NextResponse.json(
        {
          error:
            "Disconnect your current publication in Settings before connecting another.",
        },
        { status: 409 },
      );
    await db()
      .insert(publications)
      .values({ workspaceId: workspace.id, url: feed.url, title: feed.title })
      .onConflictDoUpdate({
        target: publications.workspaceId,
        set: { title: feed.title, checkedAt: new Date(), error: null },
      });
    if (!existing && feed.posts.length)
      await db()
        .insert(importJobs)
        .values(
          feed.posts.map((post) => ({
            id: randomUUID(),
            workspaceId: workspace.id,
            sourceUrl: post.url,
            state: "baseline",
            autoVersion: null,
          })),
        )
        .onConflictDoNothing();
    return NextResponse.json(feed, { headers });
  } catch {
    return NextResponse.json(
      {
        error: "Couldn’t open that feed. Use your publication’s Substack link.",
      },
      { status: 422 },
    );
  }
}
export async function PATCH(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Open substuff to check your feed." },
      { status: 403 },
    );
  try {
    const workspace = await readSession();
    if (!workspace)
      return NextResponse.json(
        { error: "Sign in to continue." },
        { status: 401 },
      );
    if (!(await claimQuota(request, "feed-sync", 20)))
      return NextResponse.json(
        { error: "Try checking again tomorrow." },
        { status: 429 },
      );
    const discovered = await discoverFeed(workspace.id);
    const [job] = await db()
      .select({ id: importJobs.id })
      .from(importJobs)
      .where(
        and(
          eq(importJobs.workspaceId, workspace.id),
          inArray(importJobs.state, ["queued"]),
        ),
      )
      .limit(1);
    if (job) await runImportJob(job.id);
    return NextResponse.json(
      { ...discovered, processed: Boolean(job) },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error: "Couldn’t finish checking your feed. Your saved Notes are safe.",
      },
      { status: 503 },
    );
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Open substuff to disconnect this feed." },
      { status: 403 },
    );
  const workspace = await readSession();
  if (workspace) {
    await db()
      .delete(publications)
      .where(eq(publications.workspaceId, workspace.id));
    await db()
      .update(importJobs)
      .set({ state: "failed", error: "Publication disconnected." })
      .where(
        and(
          eq(importJobs.workspaceId, workspace.id),
          eq(importJobs.state, "queued"),
        ),
      );
  }
  return NextResponse.json({ disconnected: true }, { headers });
}
