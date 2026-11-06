import assert from "node:assert/strict";
import test from "node:test";
import {
  articleInput,
  exportNotes,
  extractNotes,
  generatedNotes,
  isGrounded,
  sampleArticle,
  workspaceSchema,
} from "../src/lib/content";

test("sample Notes have real source passages, distinct IDs and no implicit approvals", () => {
  assert.equal(
    new Set(sampleArticle.notes.map((n) => n.id)).size,
    sampleArticle.notes.length,
  );
  for (const note of sampleArticle.notes) {
    assert.ok(isGrounded(note.source, sampleArticle.content));
    assert.equal(note.approved, false);
    assert.equal(note.original, note.text);
  }
});

test("excerpts are source content, bounded and unapproved", () => {
  const notes = extractNotes(sampleArticle.content);
  assert.equal(notes.length, 4);
  for (const note of notes) {
    assert.ok(sampleArticle.content.includes(note.text));
    assert.ok(isGrounded(note.source, sampleArticle.content));
    assert.equal(note.approved, false);
  }
});

test("excerpt mode works with a single long paragraph and preserves a long sentence", () => {
  const content = `${"a".repeat(1400)}.`;
  assert.equal(extractNotes(content)[0].text, content);
});

test("duplicate paragraphs do not generate duplicate Notes", () => {
  const paragraph = sampleArticle.content.split("\n\n")[0];
  assert.equal(extractNotes(`${paragraph}\n\n${paragraph}`).length, 1);
});

test("exports include only approved drafts", () => {
  const article = structuredClone(sampleArticle);
  article.notes[0].approved = true;
  const text = exportNotes(article);
  assert.ok(text.includes(article.notes[0].text));
  assert.ok(!text.includes(article.notes[1].text));
});

test("input validation rejects tiny, oversized and missing articles", () => {
  assert.equal(
    articleInput.safeParse({ title: "Test", content: "short" }).success,
    false,
  );
  assert.equal(
    articleInput.safeParse({ title: "", content: sampleArticle.content })
      .success,
    false,
  );
  assert.equal(
    articleInput.safeParse({ title: "Test", content: "x".repeat(60001) })
      .success,
    false,
  );
  assert.equal(articleInput.safeParse(sampleArticle).success, true);
});

test("grounding normalizes whitespace but rejects invented text", () => {
  assert.ok(isGrounded("fewer   promises", sampleArticle.content));
  assert.equal(isGrounded("I grew by 800%", sampleArticle.content), false);
});

test("generated output has a validated shape", () => {
  assert.ok(generatedNotes.safeParse({ notes: sampleArticle.notes }).success);
  assert.equal(generatedNotes.safeParse({ notes: [] }).success, false);
  assert.equal(
    generatedNotes.safeParse({
      notes: [{ angle: "Viral", text: "test", source: "test" }],
    }).success,
    false,
  );
});

test("workspace schema rejects corrupt persisted data", () => {
  assert.ok(
    workspaceSchema.safeParse({
      version: 1,
      activeId: sampleArticle.id,
      articles: [sampleArticle],
    }).success,
  );
  assert.equal(
    workspaceSchema.safeParse({ version: 1, articles: [{ title: "Broken" }] })
      .success,
    false,
  );
});
