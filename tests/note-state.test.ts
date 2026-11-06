import assert from "node:assert/strict";
import test from "node:test";
import { sampleArticle } from "../src/lib/content";
import { approvedVersion } from "../src/lib/delivery";
import { noteAttachment } from "../src/lib/note-attachment";
import { noteState, noteUpdateError, noteVersion } from "../src/lib/note-state";
import { digest } from "../src/lib/session";

const article = () => structuredClone(sampleArticle);
test("three Note states are based on authoritative delivery receipts", () => {
  const a = article(),
    n = a.notes[0];
  const receipt = { articleId: a.id, noteId: n.id, status: "sent" };
  assert.equal(noteState(n, []), "to-approve");
  assert.equal(noteState({ ...n, approved: true }, []), "approved");
  assert.equal(noteState(n, [receipt]), "posted");
  assert.equal(noteState({ ...n, approved: true }, [receipt]), "posted");
  assert.equal(noteState(n, [{ ...receipt, status: "scheduled" }]), "approved");
  assert.equal(
    noteState(n, [{ ...receipt, status: "cancelled" }]),
    "to-approve",
  );
});
test("posted text, approval and link preference cannot be edited, but unchanged documents save", () => {
  const a = article();
  const receipt = { articleId: a.id, noteId: a.notes[0].id, status: "sent" };
  assert.equal(noteUpdateError([a], [structuredClone(a)], [receipt]), null);
  for (const change of [
    { text: "Changed" },
    { approved: true },
    { includeArticle: false },
  ]) {
    const next = article();
    Object.assign(next.notes[0], change);
    assert.match(noteUpdateError([a], [next], [receipt]) || "", /read-only/);
  }
});
test("approved Notes require Edit and queued copies must be cancelled first", () => {
  const a = article();
  a.notes[0].approved = true;
  const next = structuredClone(a);
  next.notes[0].text = "Changed";
  assert.match(noteUpdateError([a], [next], []) || "", /Choose Edit/);
  next.notes[0].approved = false;
  assert.equal(noteUpdateError([a], [next], []), null);
  const receipt = {
    articleId: a.id,
    noteId: a.notes[0].id,
    status: "scheduled",
  };
  assert.match(noteUpdateError([a], [next], [receipt]) || "", /Cancel it/);
  assert.equal(
    noteUpdateError([a], [next], [{ ...receipt, status: "cancelled" }]),
    null,
  );
});
test("link opt-out omits metadata and is part of approval, without breaking legacy hashes", () => {
  const a = article();
  a.sourceUrl = "https://writer.substack.com/p/post";
  a.notes[0].approved = true;
  assert.equal(noteVersion(a.notes[0]), a.notes[0].text);
  const old = digest(a.notes[0].text);
  assert.ok(approvedVersion(a, a.notes[0].id, old));
  a.notes[0].includeArticle = false;
  assert.deepEqual(noteAttachment(a, a.notes[0]), {});
  assert.equal(approvedVersion(a, a.notes[0].id, old), null);
  assert.ok(approvedVersion(a, a.notes[0].id, digest(noteVersion(a.notes[0]))));
});
