import { lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { generationLimits, workspaces } from "@/db/schema";

export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  await db().delete(workspaces).where(lt(workspaces.expiresAt, now));
  await db()
    .delete(generationLimits)
    .where(lt(generationLimits.expiresAt, now));
  return NextResponse.json({ ok: true });
}
