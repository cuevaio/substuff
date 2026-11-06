import assert from "node:assert/strict";
import test from "node:test";
import { resolveSources, sourcePassages } from "../src/lib/source-passages";

test("source passages preserve exact original punctuation and contiguous text", () => {
  const content = `A title\n\nI tried it — and it wasn’t simple. My clients had to wait.\n\n${"Long source passage. ".repeat(400)}`;
  const passages = sourcePassages(content);
  assert.ok(passages.length > 2);
  for (const passage of passages) {
    assert.ok(content.includes(passage.text));
    assert.ok(passage.text.length >= 20 && passage.text.length <= 2500);
  }
  const resolved = resolveSources(
    {
      notes: [
        {
          angle: "An idea",
          text: "I tried it, but my clients had to wait.",
          sourceId: 0,
        },
      ],
    },
    passages,
  );
  assert.equal(resolved.notes[0].source, passages[0].text);
  assert.ok(resolved.notes[0].source.includes("—"));
});
test("invalid source references are rejected instead of fabricating a citation", () => {
  const passages = sourcePassages(
    "This original passage is long enough to support a Note.",
  );
  assert.throws(
    () =>
      resolveSources(
        {
          notes: [
            {
              angle: "An idea",
              text: "A generated Note with an invalid supporting reference.",
              sourceId: 4,
            },
          ],
        },
        passages,
      ),
    /Ungrounded source/,
  );
  assert.throws(() =>
    resolveSources(
      {
        notes: [
          {
            angle: "An idea",
            text: "A generated Note with an invalid supporting reference.",
            sourceId: -1,
          },
        ],
      },
      passages,
    ),
  );
});

test("identical generated Notes are collapsed before automatic publication", () => {
  const passages = sourcePassages(
    "This original passage is long enough to support a Note.",
  );
  const note = {
    angle: "An idea",
    text: "A complete Note supported by the original source passage.",
    sourceId: 0,
  };
  assert.equal(
    resolveSources(
      { notes: [note, { ...note, text: ` ${note.text} ` }] },
      passages,
    ).notes.length,
    1,
  );
});
