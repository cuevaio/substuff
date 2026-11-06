import { randomUUID } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { automation, importJobs, workspaces } from "@/db/schema";
import { mayAutoPublish } from "./automation-policy";
import { accessToken, substackChannels } from "./buffer";
import { type Article, workspaceSchema } from "./content";
import { safeDiagnostic } from "./generate";
import { claimBucket } from "./generation-limit";
import { sendNote } from "./send-note";
import { digest } from "./session";
import { ImportError, importSubstackPost } from "./substack";
import { parseSubstackUrl } from "./substack-url";
import { writeNotes } from "./writer";

const services = {
  readPost: importSubstackPost,
  generate: writeNotes,
  channels: substackChannels,
  token: accessToken,
  send: sendNote,
  budget: async (workspaceId: string) => {
    const day = new Date().toISOString().slice(0, 10);
    return (
      (await claimBucket(digest(`writer:${workspaceId}:${day}`), 10)) &&
      (await claimBucket(digest(`writer:global:${day}`), 50))
    );
  },
};
export type ImportServices = typeof services;

export async function enqueueImport(
  workspaceId: string,
  value: string,
  expectedVersion?: number,
) {
  const sourceUrl = parseSubstackUrl(value).url;
  const [policy] = await db()
    .select()
    .from(automation)
    .where(eq(automation.workspaceId, workspaceId));
  if (
    expectedVersion !== undefined &&
    (policy?.version ?? 0) !== expectedVersion
  )
    throw new ImportError(
      "Publishing preferences changed. Review them before importing.",
      409,
    );
  await db()
    .insert(importJobs)
    .values({
      id: randomUUID(),
      workspaceId,
      sourceUrl,
      autoVersion: mayAutoPublish(policy, policy?.version ?? null)
        ? policy.version
        : null,
    })
    .onConflictDoNothing();
  const [job] = await db()
    .select()
    .from(importJobs)
    .where(
      and(
        eq(importJobs.workspaceId, workspaceId),
        eq(importJobs.sourceUrl, sourceUrl),
      ),
    );
  if (
    expectedVersion !== undefined &&
    !job.article &&
    ["baseline", "removed", "failed"].includes(job.state)
  ) {
    const [explicit] = await db()
      .update(importJobs)
      .set({
        autoVersion: mayAutoPublish(policy, policy?.version ?? null)
          ? policy.version
          : null,
      })
      .where(
        and(
          eq(importJobs.id, job.id),
          eq(importJobs.state, job.state),
          eq(importJobs.attempts, job.attempts),
        ),
      )
      .returning();
    if (explicit) return explicit;
  }
  return job;
}

async function appendArticle(
  jobId: string,
  workspaceId: string,
  article: Article,
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const [workspace] = await db()
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, workspaceId),
          gt(workspaces.expiresAt, new Date()),
        ),
      );
    if (!workspace) throw new Error("Workspace expired");
    const existing = workspace.document.articles.find(
      (post) => post.sourceUrl === article.sourceUrl || post.id === article.id,
    );
    if (existing) return existing;
    const document = workspaceSchema.parse({
      ...workspace.document,
      articles: [article, ...workspace.document.articles],
      activeId: workspace.document.activeId || article.id,
    });
    if (JSON.stringify(document).length > 2_000_000)
      throw new Error("Workspace full");
    const [saved] = await db()
      .update(workspaces)
      .set({
        document,
        revision: workspace.revision + 1,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 86400000),
      })
      .where(
        and(
          eq(workspaces.id, workspaceId),
          eq(workspaces.revision, workspace.revision),
          sql`exists (select 1 from ${importJobs} where ${importJobs.id} = ${jobId} and ${importJobs.state} = 'running')`,
        ),
      )
      .returning({ id: workspaces.id });
    if (saved) return article;
  }
  throw new Error("Workspace changed");
}

export async function runImportJob(
  id: string,
  dependencies: ImportServices = services,
  explicitRetry = false,
) {
  const [job] = await db()
    .select()
    .from(importJobs)
    .where(eq(importJobs.id, id));
  if (!job) throw new Error("Import not found");
  if (
    job.state === "done" ||
    (job.state === "attention" && job.article && !explicitRetry)
  )
    return job;
  if (job.state === "failed" && !explicitRetry) return job;
  if (
    job.state === "running" &&
    (!job.claimedAt || job.claimedAt.getTime() > Date.now() - 5 * 60000)
  )
    return job;
  // Interrupted generation is never retried by cron. A writer can deliberately retry it.
  if (job.state === "running" && !job.article && !explicitRetry) {
    await db()
      .update(importJobs)
      .set({ state: "failed", error: "Import was interrupted. Try again." })
      .where(eq(importJobs.id, id));
    return {
      ...job,
      state: "failed",
      error: "Import was interrupted. Try again.",
    };
  }
  const [claim] = await db()
    .update(importJobs)
    .set({
      state: "running",
      claimedAt: new Date(),
      error: null,
      attempts: sql`${importJobs.attempts} + 1`,
    })
    .where(
      and(
        eq(importJobs.id, id),
        eq(importJobs.state, job.state),
        eq(importJobs.attempts, job.attempts),
      ),
    )
    .returning();
  if (!claim) return job;
  let article = job.article;
  try {
    const [workspace] = await db()
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, job.workspaceId),
          gt(workspaces.expiresAt, new Date()),
        ),
      );
    if (!workspace) throw new Error("Workspace expired");
    const existing = workspace.document.articles.find(
      (post) => post.sourceUrl === job.sourceUrl,
    );
    if (existing && !article) {
      const [saved] = await db()
        .update(importJobs)
        .set({ state: "done", article: null })
        .where(eq(importJobs.id, id))
        .returning();
      return saved;
    }
    if (!article) {
      if (!(await dependencies.budget(job.workspaceId)))
        throw new ImportError(
          "Today’s writing limit has been reached. Try again tomorrow.",
          429,
        );
      const source = await dependencies.readPost(job.sourceUrl);
      const drafts = await dependencies.generate({
        title: source.title,
        content: source.content,
      });
      const [policy] = await db()
        .select()
        .from(automation)
        .where(eq(automation.workspaceId, job.workspaceId));
      const automatic = mayAutoPublish(policy, job.autoVersion);
      article = {
        id: `post-${digest(job.sourceUrl).slice(0, 24)}`,
        ...source,
        mode: "ai",
        createdAt: new Date().toISOString(),
        notes: drafts.notes.map((note, index) => ({
          ...note,
          id: `note-${index}`,
          original: note.text,
          approved: automatic && index < policy.notesPerPost,
        })),
      };
      const [persisted] = await db()
        .update(importJobs)
        .set({ article })
        .where(and(eq(importJobs.id, id), eq(importJobs.state, "running")))
        .returning();
      if (!persisted) {
        const [stopped] = await db()
          .select()
          .from(importJobs)
          .where(eq(importJobs.id, id));
        return stopped;
      }
    }
    const stored = await appendArticle(id, job.workspaceId, article);
    // Never publish a changed version or retroactively publish a pre-existing import.
    const candidates = (stored.id === article.id ? stored.notes : []).filter(
      (note) =>
        note.approved &&
        article?.notes.some(
          (original) =>
            original.id === note.id &&
            original.text === note.text &&
            original.approved,
        ),
    );
    let attention = false;
    const [policy] = await db()
      .select()
      .from(automation)
      .where(eq(automation.workspaceId, job.workspaceId));
    if (mayAutoPublish(policy, job.autoVersion) && candidates.length) {
      const { channels } = await dependencies.channels(job.workspaceId);
      const channel = channels.find(
        (channel) => channel.id === policy.channelId,
      );
      if (
        !channel ||
        channel.isDisconnected ||
        channel.isLocked ||
        channel.isQueuePaused ||
        !channel.allowedActions.includes("scheduleUpdates")
      )
        throw new ImportError(
          "Check your Substack channel in Buffer. Your Notes were saved.",
        );
      const token = await dependencies.token(job.workspaceId);
      for (const candidate of candidates.slice(0, policy.notesPerPost)) {
        const [activeJob] = await db()
          .select({ state: importJobs.state })
          .from(importJobs)
          .where(eq(importJobs.id, id));
        if (activeJob?.state !== "running") break;
        const [current] = await db()
          .select()
          .from(automation)
          .where(eq(automation.workspaceId, job.workspaceId));
        if (!mayAutoPublish(current, job.autoVersion)) break;
        const [fresh] = await db()
          .select()
          .from(workspaces)
          .where(eq(workspaces.id, job.workspaceId));
        const currentArticle = fresh?.document.articles.find(
          (post) => post.id === stored.id,
        );
        const note = currentArticle?.notes.find(
          (note) =>
            note.id === candidate.id &&
            note.approved &&
            note.text === candidate.text,
        );
        if (!note || !currentArticle) continue;
        const sent = await dependencies.send({
          workspaceId: job.workspaceId,
          article: currentArticle,
          note,
          channelId: channel.id,
          token,
          mode: "now",
        });
        if (!sent || ["error", "unknown", "creating"].includes(sent.status)) {
          attention = true;
          break;
        }
      }
    }
    const [saved] = await db()
      .update(importJobs)
      .set({
        state: attention ? "attention" : "done",
        ...(!attention ? { article: null } : {}),
        error: attention
          ? "Check publishing activity in Buffer. No automatic resend will be attempted."
          : null,
      })
      .where(and(eq(importJobs.id, id), eq(importJobs.state, "running")))
      .returning();
    if (saved) return saved;
    const [stopped] = await db()
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, id));
    return stopped;
  } catch (cause) {
    const [currentJob] = await db()
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, id));
    if (currentJob?.state !== "running") return currentJob;
    console.warn("substuff.import_failed", {
      ...safeDiagnostic(cause),
      savedArticle: Boolean(article),
    });
    const [saved] = await db()
      .update(importJobs)
      .set({
        state: article ? "attention" : "failed",
        error:
          cause instanceof ImportError
            ? cause.message
            : "Couldn’t finish this import. Your saved Notes are safe.",
      })
      .where(and(eq(importJobs.id, id), eq(importJobs.state, "running")))
      .returning();
    return saved;
  }
}
