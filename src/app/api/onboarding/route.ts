import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { automation, importJobs, publications, workspaces } from "@/db/schema";
import { readAccountSession } from "@/lib/account-session";
import { substackChannels } from "@/lib/buffer";
import { fetchPublicationFeed } from "@/lib/feed";
import { claimQuota } from "@/lib/generation-limit";
import { enqueueImport, runImportJob } from "@/lib/import-jobs";
import { hasSubstackChannel, hasWriting } from "@/lib/onboarding";
import { sameOrigin } from "@/lib/session";
import { parsePublicationUrl } from "@/lib/substack-url";

export const maxDuration = 180;
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Open substuff to get started." },
      { status: 403 },
    );
  try {
    const workspace = await readAccountSession();
    if (!workspace)
      return NextResponse.json(
        { error: "Continue with Buffer first." },
        { status: 401 },
      );
    const { channels } = await substackChannels(workspace.id);
    if (!hasSubstackChannel(channels))
      return NextResponse.json(
        {
          error:
            "Connect an active Substack channel in Buffer, then try again.",
        },
        { status: 403 },
      );
    const raw = await request.text();
    if (raw.length > 4096)
      return NextResponse.json(
        { error: "Use your publication link." },
        { status: 400 },
      );
    let url: string;
    try {
      url = parsePublicationUrl(JSON.parse(raw).url).url;
    } catch {
      return NextResponse.json(
        { error: "Use a publication link like yourname.substack.com." },
        { status: 400 },
      );
    }
    if (!(await claimQuota(request, "onboarding", 10)))
      return NextResponse.json(
        { error: "Today’s setup limit was reached. Try again tomorrow." },
        { status: 429 },
      );
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        // A lost browser stream must not interrupt the durable import/save.
        let listening = true;
        const emit = (event: unknown) => {
          if (listening) {
            try {
              controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
            } catch {
              listening = false;
            }
          }
        };
        try {
          if (!hasWriting(workspace.document.articles)) {
            emit({ step: "content" });
            const feed = await fetchPublicationFeed(url);
            if (!feed.posts.length)
              throw new Error(
                "No public posts were found. Publish a post first, then try again.",
              );
            const [existing] = await db()
              .select()
              .from(publications)
              .where(eq(publications.workspaceId, workspace.id));
            if (existing && existing.url !== url)
              throw new Error(
                "Disconnect your previous publication in Settings first.",
              );
            await db()
              .insert(publications)
              .values({ workspaceId: workspace.id, url, title: feed.title })
              .onConflictDoNothing();
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
            const [policy] = await db()
              .select()
              .from(automation)
              .where(eq(automation.workspaceId, workspace.id));
            const job = await enqueueImport(
              workspace.id,
              feed.posts[0].url,
              policy?.version ?? 0,
            );
            const result = await runImportJob(job.id, undefined, true, {
              onProgress: (step) => emit({ step }),
            });
            if (result.state !== "done")
              throw new Error(
                result.error ||
                  "Your import is still running. Reload shortly to restore your progress.",
              );
          }
          const [fresh] = await db()
            .select()
            .from(workspaces)
            .where(eq(workspaces.id, workspace.id));
          emit({
            done: true,
            document: fresh.document,
            revision: fresh.revision,
          });
        } catch (cause) {
          // Only our public-safe workflow errors are emitted; provider failures are masked by the job runner.
          emit({
            error:
              cause instanceof Error &&
              [
                "No public posts were found. Publish a post first, then try again.",
                "Disconnect your previous publication in Settings first.",
              ].includes(cause.message)
                ? cause.message
                : "We couldn’t finish preparing your Notes. Your saved writing is safe. Try again or reload to check your workspace.",
          });
        } finally {
          if (listening) controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        ...headers,
        "Content-Type": "application/x-ndjson",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Couldn’t connect to your Substack channel. Reconnect Buffer and try again.",
      },
      { status: 503, headers },
    );
  }
}
