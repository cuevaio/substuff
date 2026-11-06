import assert from "node:assert/strict";
import test from "node:test";
import { sourceRanges } from "../src/lib/source-match";

test("source passage matches across inline emphasis without replacing article markup", () => {
  assert.deepEqual(
    sourceRanges(
      [
        { text: "This is ", block: 0 },
        { text: "important", block: 0 },
        { text: ". Keep it.", block: 0 },
      ],
      "is important.",
    ),
    [
      { node: 0, start: 5, end: 8 },
      { node: 1, start: 0, end: 9 },
      { node: 2, start: 0, end: 1 },
    ],
  );
});
test("paragraph boundaries, whitespace and exact Unicode remain grounded", () => {
  const ranges = sourceRanges(
    [
      { text: "First — thought.", block: 0 },
      { text: "Second   thought.", block: 1 },
    ],
    "thought.\n\nSecond thought.",
  );
  assert.deepEqual(ranges, [
    { node: 0, start: 8, end: 16 },
    { node: 1, start: 0, end: 17 },
  ]);
  assert.deepEqual(
    sourceRanges([{ text: "Not the source", block: 0 }], "Invented"),
    [],
  );
  assert.deepEqual(sourceRanges([{ text: "Some words", block: 0 }], ""), []);
});
