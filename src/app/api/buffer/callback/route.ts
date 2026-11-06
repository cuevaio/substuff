import { randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  automation,
  bufferAccounts,
  bufferConnections,
  importJobs,
  oauthAttempts,
  publications,
  workspaces,
} from "@/db/schema";
import { accountInfo, exchangeToken } from "@/lib/buffer";
import { seal, unseal } from "@/lib/crypto";
import { mergeRecoveredWorkspace } from "@/lib/recovery";
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
    let recoveryStatus = "connected";
    if (targetId !== workspace.id) {
      const [target] = await db()
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, targetId));
      if (!target) return home("error");
      let merged: typeof target.document;
      try {
        merged = mergeRecoveredWorkspace(target.document, workspace.document);
      } catch {
        return home("full");
      }
      const [saved] = await db()
        .update(workspaces)
        .set({
          document: merged,
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
      const [guestFeed] = await db()
        .select()
        .from(publications)
        .where(eq(publications.workspaceId, workspace.id));
      if (guestFeed) {
        const [targetFeed] = await db()
          .select()
          .from(publications)
          .where(eq(publications.workspaceId, targetId));
        const [policy] = await db()
          .select()
          .from(automation)
          .where(eq(automation.workspaceId, targetId));
        // Never attach a new publication to an already-enabled public automation policy silently.
        if (!targetFeed && !policy?.enabled) {
          await db()
            .insert(publications)
            .values({ ...guestFeed, workspaceId: targetId })
            .onConflictDoNothing();
          const baseline = await db()
            .select({ sourceUrl: importJobs.sourceUrl })
            .from(importJobs)
            .where(
              and(
                eq(importJobs.workspaceId, workspace.id),
                eq(importJobs.state, "baseline"),
              ),
            );
          if (baseline.length)
            await db()
              .insert(importJobs)
              .values(
                baseline.map((item) => ({
                  id: randomUUID(),
                  workspaceId: targetId,
                  sourceUrl: item.sourceUrl,
                  state: "baseline",
                  autoVersion: null,
                })),
              )
              .onConflictDoNothing();
        } else if (targetFeed?.url !== guestFeed.url)
          recoveryStatus = "connected_feed";
        await db()
          .delete(publications)
          .where(eq(publications.workspaceId, workspace.id));
        await db()
          .update(importJobs)
          .set({
            state: "failed",
            error:
              "Workspace recovered. Re-import this post from your saved workspace.",
          })
          .where(
            and(
              eq(importJobs.workspaceId, workspace.id),
              eq(importJobs.state, "queued"),
            ),
          );
      }
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
    return home(recoveryStatus);
  } catch {
    console.warn("substuff.buffer_callback_failed");
    return home("error");
  }
}
