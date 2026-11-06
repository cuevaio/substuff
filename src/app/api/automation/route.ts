import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { automation } from "@/db/schema";
import { readAccountSession as readSession } from "@/lib/account-session";
import { AUTO_POLICY_VERSION } from "@/lib/automation-policy";
import { sameOrigin } from "@/lib/session";

const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const workspace = await readSession();
  const [saved] = workspace
    ? await db()
        .select()
        .from(automation)
        .where(eq(automation.workspaceId, workspace.id))
    : [];
  return NextResponse.json(
    {
      enabled: Boolean(
        saved?.enabled && saved.policyVersion === AUTO_POLICY_VERSION,
      ),
      version: saved?.version ?? 0,
    },
    { headers },
  );
}
const inputSchema = z.discriminatedUnion("enabled", [
  z.object({
    enabled: z.literal(false),
    version: z.number().int().nonnegative(),
  }),
  z.object({
    enabled: z.literal(true),
    version: z.number().int().nonnegative(),
    confirmed: z.literal(true),
    policyVersion: z.literal(AUTO_POLICY_VERSION),
  }),
]);
export async function PUT(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Open substuff to change approval preferences." },
      { status: 403 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 3000) throw new Error("input");
    const input = inputSchema.safeParse(JSON.parse(raw));
    if (!input.success)
      return NextResponse.json(
        { error: "Confirm your auto-approval choice." },
        { status: 400 },
      );
    const workspace = await readSession();
    if (!workspace)
      return NextResponse.json(
        { error: "Sign in with Buffer to continue." },
        { status: 401 },
      );
    const value = input.data;
    await db()
      .insert(automation)
      .values({ workspaceId: workspace.id })
      .onConflictDoNothing();
    const [saved] = await db()
      .update(automation)
      .set({
        enabled: value.enabled,
        ...(value.enabled
          ? {
              channelId: null,
              consentAt: new Date(),
              policyVersion: value.policyVersion,
            }
          : {}),
        version: value.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(automation.workspaceId, workspace.id),
          eq(automation.version, value.version),
        ),
      )
      .returning();
    if (!saved)
      return NextResponse.json(
        {
          error:
            "This preference changed in another tab. Refresh and try again.",
        },
        { status: 409 },
      );
    return NextResponse.json(
      {
        enabled: saved.enabled,
        version: saved.version,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error: "Couldn’t change this preference. Refresh before trying again.",
      },
      { status: 503 },
    );
  }
}
