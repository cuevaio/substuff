import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions, workspaces } from "@/db/schema";

const COOKIE = "substuff_session";
export const SESSION_DAYS = 30;
export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function readSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [alias] = await db()
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, digest(token)));
  if (alias && (alias.revokedAt || alias.expiresAt.getTime() <= Date.now()))
    return null;
  const [workspace] = await db()
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, alias?.workspaceId ?? digest(token)),
        gt(workspaces.expiresAt, new Date()),
      ),
    );
  if (
    !alias &&
    workspace &&
    workspace.createdAt.getTime() + SESSION_DAYS * 86400000 <= Date.now()
  )
    return null;
  return workspace ?? null;
}

export async function bindSession(workspaceId: string) {
  const token = randomBytes(32).toString("hex");
  await db()
    .insert(sessions)
    .values({
      tokenHash: digest(token),
      workspaceId,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
    });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function createSession() {
  const token = randomBytes(32).toString("hex");
  const [workspace] = await db()
    .insert(workspaces)
    .values({
      id: digest(token),
      document: { version: 1, articles: [], activeId: "" },
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
    })
    .returning();
  await db()
    .insert(sessions)
    .values({
      tokenHash: digest(token),
      workspaceId: workspace.id,
      expiresAt: workspace.expiresAt,
    });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return workspace;
}

export async function signOutSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const workspace = await readSession();
  if (token && workspace)
    await db()
      .insert(sessions)
      .values({
        tokenHash: digest(token),
        workspaceId: workspace.id,
        expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
        revokedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: sessions.tokenHash,
        set: { revokedAt: new Date() },
      });
  jar.delete(COOKIE);
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "https:" ||
        (!process.env.VERCEL && url.protocol === "http:")) &&
      url.host === request.headers.get("host")
    );
  } catch {
    return false;
  }
}
