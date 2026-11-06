import { randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  bufferAccounts,
  bufferConnections,
  oauthAttempts,
  workspaces,
} from "@/db/schema";
import { accountInfo, exchangeToken } from "@/lib/buffer";
import { seal, unseal } from "@/lib/crypto";
import { bindSession, digest, readSession } from "@/lib/session";

function home(status: string) {
  return NextResponse.redirect(
    new URL(
      `/?buffer=${status}`,
      process.env.BUFFER_REDIRECT_URI || "https://substuff.vercel.app",
    ),
    303,
  );
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const workspace = await readSession();
    const state = params.get("state");
    if (!workspace || !state || !/^[a-f0-9]{64}$/.test(state))
      return home("expired");
    // Atomic consume: a callback cannot exchange the same authorization twice.
    const [attempt] = await db()
      .delete(oauthAttempts)
      .where(
        and(
          eq(oauthAttempts.stateHash, digest(state)),
          eq(oauthAttempts.workspaceId, workspace.id),
          gt(oauthAttempts.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!attempt) return home("expired");
    if (params.has("error")) return home("cancelled");
    const code = params.get("code");
    if (!code) return home("expired");
    const token = await exchangeToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.BUFFER_REDIRECT_URI ?? "",
      code_verifier: unseal(attempt.verifier, `${workspace.id}:pkce`),
    });
    const account = await accountInfo(token.access_token);
    const [owner] = await db()
      .select()
      .from(bufferAccounts)
      .where(eq(bufferAccounts.workspaceId, workspace.id));
    if (owner && owner.accountId !== account.id) return home("account");
    const [existing] = await db()
      .select()
      .from(bufferAccounts)
      .where(eq(bufferAccounts.accountId, account.id));
    const targetId = existing?.workspaceId ?? workspace.id;
    if (targetId !== workspace.id) {
      const [target] = await db()
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, targetId));
      if (!target) return home("error");
      const ids = new Set(
        target.document.articles.map((article) => article.id),
      );
      const merged = [
        ...target.document.articles,
        ...workspace.document.articles.filter(
          (article) => !ids.has(article.id),
        ),
      ];
      if (merged.length > 100) return home("full");
      const [saved] = await db()
        .update(workspaces)
        .set({
          document: { ...target.document, articles: merged },
          revision: target.revision + 1,
          expiresAt: new Date(Date.now() + 30 * 86400000),
        })
        .where(
          and(
            eq(workspaces.id, targetId),
            eq(workspaces.revision, target.revision),
          ),
        )
        .returning({ id: workspaces.id });
      if (!saved) return home("conflict");
    }
    const values = {
      id: randomUUID(),
      workspaceId: targetId,
      accountId: account.id,
      accountName: account.name || "Buffer account",
      accessToken: seal(token.access_token, `${targetId}:access`),
      refreshToken: seal(token.refresh_token, `${targetId}:refresh`),
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      state: "ready",
      version: 0,
      refreshStartedAt: null,
      updatedAt: new Date(),
    };
    await db()
      .insert(bufferAccounts)
      .values({ accountId: account.id, workspaceId: targetId })
      .onConflictDoNothing();
    const [binding] = await db()
      .select()
      .from(bufferAccounts)
      .where(eq(bufferAccounts.accountId, account.id));
    if (!binding || binding.workspaceId !== targetId) return home("conflict");
    const [workspaceOwner] = await db()
      .select()
      .from(bufferAccounts)
      .where(eq(bufferAccounts.workspaceId, targetId));
    if (workspaceOwner?.accountId !== account.id) return home("account");
    await db().insert(bufferConnections).values(values).onConflictDoUpdate({
      target: bufferConnections.workspaceId,
      set: values,
    });
    await bindSession(targetId);
    return home("connected");
  } catch {
    console.warn("substuff.buffer_callback_failed");
    return home("error");
  }
}
