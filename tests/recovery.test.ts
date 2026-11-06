import assert from "node:assert/strict";
import test from "node:test";
import { sampleArticle } from "../src/lib/content";
import { mergeRecoveredWorkspace } from "../src/lib/recovery";

test("recovery preserves canonical edits and deduplicates guest imports by source", () => {
  const canonical = {
    ...structuredClone(sampleArticle),
    id: "canonical",
    sourceUrl: "https://writer.substack.com/p/post",
  };
  canonical.notes[0].text = "My saved edit";
  const duplicate = {
    ...structuredClone(canonical),
    id: "other-browser",
    notes: [],
  };
  const fresh = { ...structuredClone(sampleArticle), id: "fresh" };
  const merged = mergeRecoveredWorkspace(
    { version: 1, activeId: "canonical", articles: [canonical] },
    { version: 1, activeId: "other-browser", articles: [duplicate, fresh] },
  );
  assert.equal(merged.articles.length, 2);
  assert.equal(merged.articles[0].notes[0].text, "My saved edit");
  assert.equal(merged.activeId, "canonical");
});
test("guest recovery cannot overflow or silently truncate the canonical workspace", () => {
  const full = {
    version: 1 as const,
    activeId: "a-0",
    articles: Array.from({ length: 100 }, (_, i) => ({
      ...structuredClone(sampleArticle),
      id: `a-${i}`,
    })),
  };
  assert.throws(() =>
    mergeRecoveredWorkspace(full, {
      version: 1,
      activeId: "new",
      articles: [{ ...structuredClone(sampleArticle), id: "new" }],
    }),
  );
});
