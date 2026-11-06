import assert from "node:assert/strict";
import test from "node:test";
import { isSummaryVoice } from "../src/lib/editorial";

test("rejects detached author summaries absent from source", () => {
  assert.ok(
    isSummaryVoice(
      "The author found a better routine.",
      "I tried keeping one list.",
    ),
  );
  assert.equal(
    isSummaryVoice("I tried keeping one list.", "I tried keeping one list."),
    false,
  );
});

test("allows actual source discussions of an author", () => {
  assert.equal(
    isSummaryVoice(
      "The author writes about history.",
      "The author writes about history.",
    ),
    false,
  );
});
