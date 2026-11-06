import { sql } from "drizzle-orm";
import { db } from "@/db";
import { generationLimits } from "@/db/schema";
import { digest } from "@/lib/session";

export async function claimQuota(
  request: Request,
  bucket: string,
  limit: number,
) {
  if (!process.env.DATABASE_URL || !process.env.RATE_LIMIT_SALT) return false;
  // Vercel's trusted client-IP header in production, shared local bucket otherwise.
  const ip = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown"
    : "local";
  const day = new Date().toISOString().slice(0, 10);
  const key = digest(`${process.env.RATE_LIMIT_SALT}:${bucket}:${day}:${ip}`);
  const [claim] = await db()
    .insert(generationLimits)
    .values({ key, count: 1, expiresAt: new Date(Date.now() + 2 * 86400000) })
    .onConflictDoUpdate({
      target: generationLimits.key,
      set: { count: sql`${generationLimits.count} + 1` },
      setWhere: sql`${generationLimits.count} < ${limit}`,
    })
    .returning({ count: generationLimits.count });
  return Boolean(claim);
}

export function claimGeneration(request: Request) {
  return claimQuota(request, "generation", 10);
}
