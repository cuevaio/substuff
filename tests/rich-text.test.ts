import assert from "node:assert/strict";
import test from "node:test";
import { sampleArticle, workspaceSchema } from "../src/lib/content";
import {
  canSendThroughBuffer,
  noteAttachment,
} from "../src/lib/note-attachment";
import {
  hasRichFormatting,
  plainDocument,
  type RichNode,
  richDocumentSchema,
  richTextHtml,
  richTextToPlain,
} from "../src/lib/rich-text";

test("article link is attached separately and never appended to the Note body", () => {
  assert.deepEqual(
    noteAttachment({
      title: "My post",
      sourceUrl: "https://writer.substack.com/p/my-post",
    }),
    {
      metadata: {
        substack: {
          linkAttachment: {
            url: "https://writer.substack.com/p/my-post",
            title: "My post",
          },
        },
      },
    },
  );
  assert.deepEqual(noteAttachment({ title: "Old post" }), {});
  assert.throws(() =>
    noteAttachment({
      title: "Bad link",
      sourceUrl: "https://example.org/private",
    }),
  );
});
test("plain Notes round-trip through the rich editor without changing their text", () => {
  const text =
    "First paragraph.\n\nSecond <paragraph> & its text.\nA line break.";
  const doc = richDocumentSchema.parse(plainDocument(text));
  assert.equal(richTextToPlain(doc), text);
  assert.equal(hasRichFormatting(doc), false);
  assert.equal(canSendThroughBuffer({ richText: doc }), true);
});
test("bold/italic/strike/code and structural formatting cannot silently flatten through Buffer", () => {
  for (const type of ["bold", "italic", "strike", "code"]) {
    const doc: RichNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "My Note", marks: [{ type }] }],
        },
      ],
    };
    assert.equal(
      canSendThroughBuffer({ richText: richDocumentSchema.parse(doc) }),
      false,
    );
    assert.equal(richTextToPlain(doc), "My Note");
  }
  for (const type of ["bulletList", "orderedList", "blockquote", "codeBlock"])
    assert.equal(hasRichFormatting({ type, content: [] }), true);
});
test("formatted clipboard HTML escapes text and only emits known tags", () => {
  const doc: RichNode = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: '<script>alert("x")</script>',
            marks: [{ type: "bold" }],
          },
        ],
      },
    ],
  };
  assert.match(richTextHtml(doc), /<strong>&lt;script&gt;/);
  assert.equal(richTextHtml(doc).includes("<script>"), false);
  assert.throws(() =>
    richDocumentSchema.parse({
      type: "doc",
      content: [{ type: "image", attrs: { src: "javascript:evil()" } }],
    }),
  );
});
test("oversized nesting and mismatched visible text are rejected before saving", () => {
  let doc: RichNode = plainDocument("A valid Note");
  for (let index = 0; index < 15; index++)
    doc = { type: "blockquote", content: [doc] };
  assert.equal(richDocumentSchema.safeParse(doc).success, false);
  const article = structuredClone(sampleArticle);
  article.notes[0].richText = plainDocument("Different content");
  assert.equal(
    workspaceSchema.safeParse({
      version: 1,
      activeId: article.id,
      articles: [article],
    }).success,
    false,
  );
});
