import assert from "node:assert/strict";
import test from "node:test";
import { sampleArticle } from "../src/lib/content";
import {
  approvedVersion,
  deliveryInput,
  deliveryKey,
  validSchedule,
} from "../src/lib/delivery";
import { digest } from "../src/lib/session";

test("only the exact server-approved version can be sent", () => {
  const article = structuredClone(sampleArticle);
  const note = article.notes[0];
  assert.equal(approvedVersion(article, note.id, digest(note.text)), null);
  note.approved = true;
  assert.equal(
    approvedVersion(article, note.id, digest(note.text))?.id,
    note.id,
  );
  assert.equal(
    approvedVersion(article, note.id, digest("outdated text")),
    null,
  );
  note.text = " ";
  assert.equal(approvedVersion(article, note.id, digest(note.text)), null);
});

test("idempotency binds to workspace, channel and exact Note version", () => {
  const base = deliveryKey("workspace", "channel", "article", "note", "text");
  assert.equal(
    base,
    deliveryKey("workspace", "channel", "article", "note", "text"),
  );
  assert.notEqual(
    base,
    deliveryKey("other", "channel", "article", "note", "text"),
  );
  assert.notEqual(
    base,
    deliveryKey("workspace", "channel", "article", "note", "changed text"),
  );
});

test("publishing requires explicit confirmation and distinct Notes", () => {
  const note = { id: "one", hash: digest("text") };
  const input = {
    articleId: "article",
    channelId: "channel",
    mode: "draft",
    confirmed: true,
    notes: [note],
  };
  assert.ok(deliveryInput.safeParse(input).success);
  assert.equal(
    deliveryInput.safeParse({ ...input, confirmed: false }).success,
    false,
  );
  assert.equal(
    deliveryInput.safeParse({ ...input, notes: [note, note] }).success,
    false,
  );
  assert.equal(
    deliveryInput.safeParse({ ...input, mode: "schedule" }).success,
    false,
  );
});

test("scheduling rejects invalid, too-near and excessively distant dates", () => {
  const now = Date.UTC(2026, 10, 6);
  assert.equal(validSchedule("invalid", now), false);
  assert.equal(validSchedule(new Date(now + 60000).toISOString(), now), false);
  assert.equal(
    validSchedule(new Date(now + 86400000).toISOString(), now),
    true,
  );
  assert.equal(
    validSchedule(new Date(now + 91 * 86400000).toISOString(), now),
    false,
  );
});
