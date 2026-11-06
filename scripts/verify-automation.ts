// Real dedicated database, isolated disposable workspaces, mocked external publishing.
// Never enables automation or sends a post for a real creator account.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import {
  automation,
  deliveries,
  importJobs,
  publications,
  workspaces,
} from "../src/db/schema";
import { discoverFeed } from "../src/lib/feed-sync";
import {
  enqueueImport,
  type ImportServices,
  runImportJob,
} from "../src/lib/import-jobs";
import { sendNote } from "../src/lib/send-note";

if (process.env.SUBSTUFF_QA_DATABASE !== "true")
  throw new Error(
    "Run with SUBSTUFF_QA_DATABASE=true against the dedicated substuff database.",
  );
const created: string[] = [];
const originalFetch = globalThis.fetch;
let calls = 0;
let unknown = false;
let stage = "setup";
const content =
  "This is disposable QA writing. Every Note remains source linked. These fixtures exercise consent, durable import claims, exact-version delivery and safe retries without publishing anything for a real account. There is no external social-network destination.";
const source = "https://qa-test.substack.com/p/disposable-post";
const drafts = {
  notes: [0, 1].map((index) => ({
    angle: "An idea" as const,
    text: `Disposable QA Note ${index + 1}: consent is checked before any publication.`,
    source: content,
  })),
};

globalThis.fetch = (async (input, options) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (new URL(url).hostname === "api.buffer.com") {
    calls++;
    const body = JSON.parse(String(options?.body));
    assert.equal(body.variables.input.mode, "shareNow");
    assert.equal(body.variables.input.saveToDraft, false);
    assert.ok(
      body.variables.input.metadata.substack.linkAttachment.url.startsWith(
        "https://qa-test.substack.com/p/",
      ),
    );
    assert.equal(body.variables.input.text.includes("https://"), false);
    if (unknown) throw new TypeError("QA simulated lost confirmation");
    return Response.json({
      data: {
        createPost: {
          __typename: "PostActionSuccess",
          post: { id: `qa-only-${randomUUID()}`, status: "sent", dueAt: null },
        },
      },
    });
  }
  if (new URL(url).hostname === "qa-test.substack.com") {
    assert.equal(new URL(url).pathname, "/feed");
    const earlier = new Date(Date.now() - 86400000).toUTCString();
    const newer = new Date(Date.now() - 60000).toUTCString();
    return new Response(
      `<rss><channel><title>QA publication</title><item><title>Earlier</title><link>https://qa-test.substack.com/p/earlier</link><pubDate>${earlier}</pubDate></item><item><title>Newer</title><link>https://qa-test.substack.com/p/newer</link><pubDate>${newer}</pubDate></item></channel></rss>`,
    );
  }
  return originalFetch(input, options);
}) as typeof fetch;

async function workspace(enabled = false, count = 1) {
  const id = `qa-auto-${randomUUID()}`;
  await db()
    .insert(workspaces)
    .values({
      id,
      document: { version: 1, activeId: "", articles: [] },
      expiresAt: new Date(Date.now() + 3600000),
    });
  created.push(id);
  await db()
    .insert(automation)
    .values({
      workspaceId: id,
      enabled,
      version: enabled ? 1 : 0,
      channelId: enabled ? "qa-channel" : null,
      notesPerPost: count,
      consentAt: enabled ? new Date() : null,
      policyVersion: enabled ? 1 : 0,
    });
  return id;
}
function dependencies(overrides: Partial<ImportServices> = {}): ImportServices {
  return {
    readPost: async (url) => ({
      title: "Disposable QA post",
      content,
      sourceUrl: url,
    }),
    generate: async () => structuredClone(drafts),
    analyze: async () => ({
      ideas: ["Consent is required."],
      style: "Concise first-person observations with qualifications.",
    }),
    budget: async () => true,
    channels: async () => ({
      accountName: "QA fixture",
      channels: [
        {
          id: "qa-channel",
          name: "QA",
          displayName: "QA",
          organizationId: "qa-org",
          organizationName: "QA",
          service: "substack",
          timezone: "UTC",
          isDisconnected: false,
          isLocked: false,
          isQueuePaused: false,
          allowedActions: ["scheduleUpdates"],
        },
      ],
    }),
    token: async () => "qa-test-token-never-sent-externally",
    send: sendNote,
    ...overrides,
  };
}
try {
  stage = "onboarding is draft-only even with an enabled automation policy";
  const onboarding = await workspace(true, 2);
  const onboardingJob = await enqueueImport(onboarding, source, 1);
  const progress: string[] = [];
  let voiceUsed = false;
  const onboardingResult = await runImportJob(
    onboardingJob.id,
    dependencies({
      generate: async (input) => {
        voiceUsed = Boolean(input.voice?.style);
        return structuredClone(drafts);
      },
    }),
    true,
    { draftOnly: true, onProgress: (step) => progress.push(step) },
  );
  assert.equal(onboardingResult.state, "done");
  assert.deepEqual(progress, ["content", "understanding", "style", "writing"]);
  assert.equal(voiceUsed, true);
  assert.equal(calls, 0);
  const [onboarded] = await db()
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, onboarding));
  assert.ok(
    onboarded.document.articles[0].notes.every((note) => !note.approved),
  );

  stage = "draft default";
  const badAnalysis = await workspace(true);
  const badAnalysisJob = await enqueueImport(badAnalysis, source);
  let prematureGeneration = false;
  const guarded = await runImportJob(
    badAnalysisJob.id,
    dependencies({
      analyze: async () => {
        throw new Error("QA analysis failure");
      },
      generate: async () => {
        prematureGeneration = true;
        return structuredClone(drafts);
      },
    }),
    true,
    { draftOnly: true, onProgress: () => {} },
  );
  assert.equal(guarded.state, "failed");
  assert.equal(prematureGeneration, false);
  assert.equal(calls, 0);

  const manual = await workspace();
  const manualJob = await enqueueImport(manual, source);
  const manualResult = await runImportJob(manualJob.id, dependencies());
  assert.equal(manualResult.state, "done");
  assert.equal(calls, 0);
  const [manualDocument] = await db()
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, manual));
  assert.ok(
    manualDocument.document.articles[0].notes.every((note) => !note.approved),
  );

  stage = "concurrent immediate publication";
  const automatic = await workspace(true, 2);
  let generations = 0;
  const autoJob = await enqueueImport(automatic, source, 1);
  const concurrent = dependencies({
    generate: async () => {
      generations++;
      return structuredClone(drafts);
    },
  });
  await Promise.all([
    runImportJob(autoJob.id, concurrent),
    runImportJob(autoJob.id, concurrent),
  ]);
  const sent = await db()
    .select()
    .from(deliveries)
    .where(eq(deliveries.workspaceId, automatic));
  assert.equal(generations, 1);
  assert.equal(sent.length, 2);
  assert.equal(calls, 2);
  await runImportJob(autoJob.id, concurrent);
  assert.equal(calls, 2);
  const sameJob = await enqueueImport(automatic, `${source}?utm_source=qa`, 1);
  assert.equal(sameJob.id, autoJob.id);
  await assert.rejects(
    enqueueImport(automatic, "https://qa-test.substack.com/p/other", 0),
  );

  stage = "opt-out during generation";
  const optedOut = await workspace(true);
  const outJob = await enqueueImport(optedOut, source);
  const out = await runImportJob(
    outJob.id,
    dependencies({
      generate: async () => {
        await db()
          .update(automation)
          .set({ enabled: false, version: 2 })
          .where(eq(automation.workspaceId, optedOut));
        return structuredClone(drafts);
      },
    }),
  );
  assert.equal(out.state, "done");
  assert.equal(calls, 2);
  const [optedOutDocument] = await db()
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, optedOut));
  assert.ok(
    optedOutDocument.document.articles[0].notes.every((note) => !note.approved),
  );

  stage = "uncertain response is never resent";
  const uncertain = await workspace(true);
  const uncertainJob = await enqueueImport(uncertain, source);
  unknown = true;
  const lost = await runImportJob(uncertainJob.id, dependencies());
  assert.equal(lost.state, "attention");
  const afterLost = calls;
  await runImportJob(uncertainJob.id, dependencies(), true);
  assert.equal(calls, afterLost);
  const [receipt] = await db()
    .select()
    .from(deliveries)
    .where(eq(deliveries.workspaceId, uncertain));
  assert.equal(receipt.status, "unknown");
  unknown = false;

  stage = "feed baseline and duplicate discovery";
  const feed = await workspace();
  await db()
    .insert(publications)
    .values({
      workspaceId: feed,
      url: "https://qa-test.substack.com",
      title: "QA",
      connectedAt: new Date(Date.now() - 3600000),
    });
  await discoverFeed(feed);
  await discoverFeed(feed);
  const feedJobs = await db()
    .select()
    .from(importJobs)
    .where(eq(importJobs.workspaceId, feed));
  assert.equal(feedJobs.length, 1);
  assert.equal(feedJobs[0].sourceUrl, "https://qa-test.substack.com/p/newer");
  assert.equal(feedJobs[0].autoVersion, null);
  const beforeBaseline = calls;
  await db().insert(importJobs).values({
    id: randomUUID(),
    workspaceId: feed,
    sourceUrl: "https://qa-test.substack.com/p/earlier",
    state: "baseline",
    autoVersion: null,
  });
  await db()
    .update(automation)
    .set({
      enabled: true,
      version: 1,
      channelId: "qa-channel",
      policyVersion: 1,
      consentAt: new Date(),
    })
    .where(eq(automation.workspaceId, feed));
  await runImportJob(feedJobs[0].id, dependencies());
  assert.equal(
    calls,
    beforeBaseline,
    "Enabling automation must not publish an already queued draft-only job",
  );
  const chosenEarlier = await enqueueImport(
    feed,
    "https://qa-test.substack.com/p/earlier",
    1,
  );
  await runImportJob(chosenEarlier.id, dependencies(), true);
  assert.equal(
    calls,
    beforeBaseline + 1,
    "A deliberate Import & publish can authorize one selected baseline item",
  );

  stage = "turn off stops later Notes in the batch";
  const stopped = await workspace(true, 2);
  const stopJob = await enqueueImport(stopped, source);
  const beforeStop = calls;
  await runImportJob(
    stopJob.id,
    dependencies({
      send: async (input) => {
        const receipt = await sendNote(input);
        await db()
          .update(automation)
          .set({ enabled: false, version: 2 })
          .where(eq(automation.workspaceId, stopped));
        return receipt;
      },
    }),
  );
  assert.equal(calls - beforeStop, 1);

  stage = "failed generation needs deliberate retry";
  const failed = await workspace();
  const failedJob = await enqueueImport(failed, source);
  let failedCalls = 0;
  const failing = dependencies({
    generate: async () => {
      failedCalls++;
      throw new Error("QA generation failure");
    },
  });
  assert.equal((await runImportJob(failedJob.id, failing)).state, "failed");
  await runImportJob(failedJob.id, failing);
  assert.equal(failedCalls, 1);
  assert.equal(
    (await runImportJob(failedJob.id, dependencies(), true)).state,
    "done",
  );

  stage = "clearing writing stops an in-progress import";
  const removed = await workspace();
  const removedJob = await enqueueImport(removed, source);
  const stoppedImport = await runImportJob(
    removedJob.id,
    dependencies({
      generate: async () => {
        await db()
          .update(importJobs)
          .set({ state: "removed", article: null, autoVersion: null })
          .where(eq(importJobs.id, removedJob.id));
        return structuredClone(drafts);
      },
    }),
  );
  assert.equal(stoppedImport.state, "removed");
  const [empty] = await db()
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, removed));
  assert.equal(empty.document.articles.length, 0);

  stage = "budget exhaustion never starts a model call";
  const limited = await workspace();
  const limitedJob = await enqueueImport(limited, source);
  let modelCalls = 0;
  const limitedResult = await runImportJob(
    limitedJob.id,
    dependencies({
      budget: async () => false,
      generate: async () => {
        modelCalls++;
        return structuredClone(drafts);
      },
    }),
  );
  assert.equal(limitedResult.state, "failed");
  assert.equal(modelCalls, 0);

  console.log(
    "PASS: real-database draft default, durable concurrent imports, immediate-send payload, duplicate prevention, consent-version isolation, opt-out, lost confirmation, feed baseline and explicit generation retry. External publishing was mocked; no creator account was enabled.",
  );
} catch {
  console.error(`FAIL: automation QA at ${stage}; details withheld.`);
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  if (created.length)
    await db()
      .delete(workspaces)
      .where(and(inArray(workspaces.id, created)));
}
