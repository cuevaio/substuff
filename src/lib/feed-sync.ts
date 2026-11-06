import { and, asc, eq, gt, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { importJobs, publications, workspaces } from "@/db/schema";
import { fetchPublicationFeed, newFeedPosts } from "./feed";
import { enqueueImport, runImportJob } from "./import-jobs";

export async function discoverFeed(workspaceId: string) {
  const [publication] = await db()
    .select()
    .from(publications)
    .where(eq(publications.workspaceId, workspaceId));
  if (!publication) return { discovered: 0 };
  try {
    const feed = await fetchPublicationFeed(publication.url);
    const posts = newFeedPosts(feed.posts, publication.connectedAt);
    for (const post of posts.slice(0, 10))
      await enqueueImport(workspaceId, post.url);
    await db()
      .update(publications)
      .set({ checkedAt: new Date(), title: feed.title, error: null })
      .where(eq(publications.workspaceId, workspaceId));
    return { discovered: posts.length };
  } catch {
    await db()
      .update(publications)
      .set({
        checkedAt: new Date(),
        error: "Couldn’t check this feed. Try again later.",
      })
      .where(eq(publications.workspaceId, workspaceId));
    return {
      discovered: 0,
      error: "Couldn’t check this feed. Try again later.",
    };
  }
}

export async function runFeedTick() {
  const start = Date.now();
  const feeds = await db()
    .select({ workspaceId: publications.workspaceId })
    .from(publications)
    .innerJoin(workspaces, eq(workspaces.id, publications.workspaceId))
    .where(gt(workspaces.expiresAt, new Date()))
    .orderBy(asc(publications.checkedAt))
    .limit(5);
  for (const feed of feeds) {
    if (Date.now() - start > 70000) break;
    await discoverFeed(feed.workspaceId);
  }
  const jobs = await db()
    .select({ id: importJobs.id })
    .from(importJobs)
    .innerJoin(workspaces, eq(workspaces.id, importJobs.workspaceId))
    .where(
      and(
        gt(workspaces.expiresAt, new Date()),
        or(
          inArray(importJobs.state, ["queued"]),
          and(
            eq(importJobs.state, "running"),
            lt(importJobs.claimedAt, new Date(Date.now() - 5 * 60000)),
          ),
        ),
      ),
    )
    .orderBy(asc(importJobs.createdAt))
    .limit(2);
  for (const job of jobs) {
    if (Date.now() - start > 120000) break;
    await runImportJob(job.id);
  }
  return { checked: feeds.length, imports: jobs.length };
}
