import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { workspaceSchema } from "@/lib/content";
import { claimQuota } from "@/lib/generation-limit";
import { createSession, readSession, sameOrigin } from "@/lib/session";

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
    let workspace = await readSession();
    if (!workspace) {
      if (!(await claimQuota(request, "workspace", 20)))
        return NextResponse.json(
          {
            error:
              "Workspace creation is temporarily limited. Your writing is safe on this device.",
          },
          { status: 429 },
        );
      workspace = await createSession();
    }
    const [saved] = await db()
      .update(workspaces)
      .set({
        document: input.data.document,
        revision: workspace.revision + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaces.id, workspace.id),
          eq(workspaces.revision, input.data.revision),
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
