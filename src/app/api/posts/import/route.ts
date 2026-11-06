import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { automation, workspaces } from "@/db/schema";
import { readAccountSession as readSession } from "@/lib/account-session";
import { substackChannels } from "@/lib/buffer";
import { claimQuota } from "@/lib/generation-limit";
import { enqueueImport, runImportJob } from "@/lib/import-jobs";
import { hasSubstackChannel } from "@/lib/onboarding";
import { sameOrigin } from "@/lib/session";
import { ImportError } from "@/lib/substack";
import { parseSubstackUrl } from "@/lib/substack-url";

export const maxDuration = 180;
const inputSchema = z.object({
  url: z.string().max(2048),
  automationVersion: z.number().int().nonnegative(),
});
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Open substuff to import a post." },
      { status: 403 },
    );
  let input: z.infer<typeof inputSchema>;
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new Error("input");
    input = inputSchema.parse(JSON.parse(raw));
    input.url = parseSubstackUrl(input.url).url;
  } catch {
    return NextResponse.json(
      { error: "Add a published Substack post link." },
      { status: 400 },
    );
  }
  try {
    const workspace = await readSession();
    if (!workspace)
      return NextResponse.json(
        { error: "Save your workspace before importing." },
        { status: 401 },
      );
    const { channels } = await substackChannels(workspace.id);
    if (!hasSubstackChannel(channels))
      return NextResponse.json(
        { error: "Connect your Substack channel in Buffer first." },
        { status: 403 },
      );
    const [policy] = await db()
      .select()
      .from(automation)
      .where(eq(automation.workspaceId, workspace.id));
    if ((policy?.version ?? 0) !== input.automationVersion)
      return NextResponse.json(
        {
          error: "Approval preferences changed. Review them before importing.",
        },
        { status: 409 },
      );
    if (!(await claimQuota(request, "post-import", 40)))
      return NextResponse.json(
        { error: "Today’s import limit has been reached." },
        { status: 429 },
      );
    const existing = workspace.document.articles.find(
      (article) => article.sourceUrl === input.url,
    );
    let jobState = "done";
    let warning: string | null = null;
    if (!existing) {
      const job = await enqueueImport(
        workspace.id,
        input.url,
        input.automationVersion,
      );
      const result = await runImportJob(job.id, undefined, true);
      jobState = result.state;
      warning = result.error;
      if (result.state === "running")
        return NextResponse.json(
          {
            error:
              "This import is still running. Reload your workspace shortly.",
          },
          { status: 409 },
        );
      if (
        result.state === "failed" ||
        (result.state === "attention" && !result.article)
      )
        return NextResponse.json(
          { error: result.error || "Couldn’t create Notes. Please try again." },
          { status: 422 },
        );
    }
    const [fresh] = await db()
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspace.id));
    const article = fresh.document.articles.find(
      (article) => article.sourceUrl === input.url,
    );
    if (!article)
      return NextResponse.json(
        { error: "Couldn’t save this post. Reload before trying again." },
        { status: 409 },
      );
    return NextResponse.json(
      {
        article,
        document: fresh.document,
        revision: fresh.revision,
        state: jobState,
        warning,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof ImportError
            ? cause.message
            : "Couldn’t finish importing. Reload your workspace before trying again.",
      },
      { status: cause instanceof ImportError ? cause.status : 503 },
    );
  }
}
