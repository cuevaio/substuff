import { lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  generationLimits,
  oauthAttempts,
  sessions,
  workspaces,
} from "@/db/schema";
import { runFeedTick } from "@/lib/feed-sync";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  await db().delete(oauthAttempts).where(lt(oauthAttempts.expiresAt, now));
  await db().delete(sessions).where(lt(sessions.expiresAt, now));
  await db().delete(workspaces).where(lt(workspaces.expiresAt, now));
  await db()
    .delete(generationLimits)
    .where(lt(generationLimits.expiresAt, now));
  const feed = await runFeedTick();
  return NextResponse.json({ ok: true, feed });
}
