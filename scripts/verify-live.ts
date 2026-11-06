import assert from "node:assert/strict";
import { generatedNotes, isGrounded, sampleArticle } from "../src/lib/content";

const origin = process.env.QA_ORIGIN || "http://127.0.0.1:3100";
const headers = { Origin: origin, "Content-Type": "application/json" };
const empty = { version: 1, activeId: "", articles: [] };
const document = {
  version: 1,
  activeId: sampleArticle.id,
  articles: [sampleArticle],
};

const status = await fetch(`${origin}/api/workspace`);
assert.equal(status.status, 200);
assert.equal((await status.json()).storage, "cloud");
const denied = await fetch(`${origin}/api/workspace`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://example.org",
  },
  body: JSON.stringify({ revision: 0, document }),
});
assert.equal(denied.status, 403);
const importDenied = await fetch(`${origin}/api/import`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://example.org",
  },
  body: JSON.stringify({ url: "https://writer.substack.com/p/test" }),
});
assert.equal(importDenied.status, 403);
const unsafeImport = await fetch(`${origin}/api/import`, {
  method: "POST",
  headers,
  body: JSON.stringify({ url: "http://127.0.0.1/private" }),
});
assert.equal(unsafeImport.status, 400);

const save = await fetch(`${origin}/api/workspace`, {
  method: "PUT",
  headers,
  body: JSON.stringify({ revision: 0, document }),
});
assert.equal(save.status, 200);
const revision = (await save.json()).revision;
const cookie = save.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie, "Server should issue a private workspace cookie");
const read = await fetch(`${origin}/api/workspace`, {
  headers: { Cookie: cookie },
});
assert.equal(
  (await read.json()).document.articles[0].title,
  sampleArticle.title,
);
const isolated = await fetch(`${origin}/api/workspace`);
assert.equal(
  (await isolated.json()).document,
  null,
  "A different browser must not see the workspace",
);
const conflict = await fetch(`${origin}/api/workspace`, {
  method: "PUT",
  headers: { ...headers, Cookie: cookie },
  body: JSON.stringify({ revision: 0, document: empty }),
});
assert.equal(conflict.status, 409);
const malformed = await fetch(`${origin}/api/workspace`, {
  method: "PUT",
  headers,
  body: '{"document":{}}',
});
assert.equal(malformed.status, 400);
const cleared = await fetch(`${origin}/api/workspace`, {
  method: "PUT",
  headers: { ...headers, Cookie: cookie },
  body: JSON.stringify({ revision, document: empty }),
});
assert.equal(cleared.status, 200);
console.log(
  "PASS: Neon persistence, cookie isolation, origin protection, import URL rejection, revision conflict, input rejection, workspace clearing.",
);

if (process.argv.includes("--ai")) {
  const result = await fetch(`${origin}/api/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: sampleArticle.title,
      content: sampleArticle.content,
    }),
  });
  assert.equal(result.status, 200, "Live Gateway generation should succeed");
  const output = generatedNotes.parse(await result.json());
  assert.ok(
    output.notes.every((note) =>
      isGrounded(note.source, sampleArticle.content),
    ),
  );
  console.log(
    `PASS: Live AI SDK → Vercel AI Gateway structured generation; ${output.notes.length} source-linked Notes.`,
  );
}
